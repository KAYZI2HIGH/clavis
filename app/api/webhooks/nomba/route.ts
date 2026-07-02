import crypto from "crypto";
import { after } from "next/server";
import { getNombaWebhookSecret } from "@/lib/nomba/env";
import {
  parseNombaPayload,
  parseTransferEventData,
  parseVirtualAccountFundedData,
  type NombaWebhookPayload,
} from "@/lib/nomba/webhook-types";
import { getServiceClient } from "@/lib/supabase/service";
import { makeId } from "@/lib/vault-utils";

export const runtime = "nodejs";

async function isDuplicateRequest(requestId: string): Promise<boolean> {
  const { data, error } = await getServiceClient()
    .from("webhook_events")
    .select("id")
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) {
    console.error("[nomba webhook] idempotency check failed", {
      requestId,
      error: error.message,
    });
    return false;
  }

  return data !== null;
}

async function recordWebhookEvent(
  requestId: string,
  eventType: string,
): Promise<boolean> {
  const { error } = await getServiceClient().from("webhook_events").insert({
    request_id: requestId,
    event_type: eventType,
  });

  if (error) {
    if (error.code === "23505") {
      return false;
    }
    console.error("[nomba webhook] failed to record webhook event", {
      requestId,
      eventType,
      error: error.message,
    });
    throw error;
  }

  return true;
}

async function incrementVaultBalanceKobo(
  vaultId: string,
  deltaKobo: number,
): Promise<{ ok: true; newBalance: number } | { ok: false; error: string }> {
  const { data, error } = await getServiceClient().rpc(
    "increment_vault_balance_kobo",
    {
      p_vault_id: vaultId,
      p_delta_kobo: deltaKobo,
    },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, newBalance: data as number };
}

async function handleVaultFunded(
  payload: NombaWebhookPayload,
): Promise<void> {
  const data = parseVirtualAccountFundedData(payload.data);
  if (!data) {
    console.warn("[nomba webhook] invalid virtual_account.funded payload", {
      requestId: payload.requestId,
    });
    return;
  }

  const { data: vault, error: vaultError } = await getServiceClient()
    .from("vaults")
    .select("id, quorum")
    .eq("nomba_virtual_account_number", data.accountNumber)
    .maybeSingle();

  if (vaultError) {
    console.error("[nomba webhook] vault lookup failed", {
      accountNumber: data.accountNumber,
      error: vaultError.message,
    });
    return;
  }

  if (!vault) {
    console.warn("[nomba webhook] no vault for virtual account", {
      accountNumber: data.accountNumber,
      requestId: payload.requestId,
    });
    return;
  }

  const { data: existingTx } = await getServiceClient()
    .from("transactions")
    .select("id")
    .eq("nomba_tx_ref", data.merchantTxRef)
    .maybeSingle();

  if (existingTx) {
    console.warn("[nomba webhook] duplicate nomba_tx_ref, skipping", {
      merchantTxRef: data.merchantTxRef,
      requestId: payload.requestId,
    });
    return;
  }

  const balanceResult = await incrementVaultBalanceKobo(vault.id, data.amount);
  if (!balanceResult.ok) {
    console.error("[nomba webhook] failed to update vault balance", {
      vaultId: vault.id,
      error: balanceResult.error,
    });
    return;
  }

  const now = new Date().toISOString();
  const { error: txError } = await getServiceClient().from("transactions").insert({
    id: makeId("TX"),
    vault_id: vault.id,
    recipient_name: "Vault funding",
    recipient_account: data.accountNumber,
    amount_kobo: data.amount,
    memo: "Vault funded",
    narration: "Vault funded",
    requested_by: null,
    requested_at: now,
    status: "settled",
    required_quorum: vault.quorum,
    settled_at: now,
    nomba_tx_ref: data.merchantTxRef,
  });

  if (txError) {
    if (txError.code === "23505") {
      console.warn("[nomba webhook] duplicate nomba_tx_ref on insert", {
        merchantTxRef: data.merchantTxRef,
      });
      return;
    }
    console.error("[nomba webhook] failed to insert funding transaction", {
      vaultId: vault.id,
      error: txError.message,
    });
  }
}

async function handleTransferSuccess(
  payload: NombaWebhookPayload,
): Promise<void> {
  const data = parseTransferEventData(payload.data);
  if (!data) {
    console.warn("[nomba webhook] invalid transfer.success payload", {
      requestId: payload.requestId,
    });
    return;
  }

  const { data: tx, error: txError } = await getServiceClient()
    .from("transactions")
    .select("id, status")
    .eq("nomba_tx_ref", data.merchantTxRef)
    .maybeSingle();

  if (txError) {
    console.error("[nomba webhook] transfer.success lookup failed", {
      merchantTxRef: data.merchantTxRef,
      error: txError.message,
    });
    return;
  }

  if (!tx) {
    console.warn("[nomba webhook] no transaction for transfer.success", {
      merchantTxRef: data.merchantTxRef,
      requestId: payload.requestId,
    });
    return;
  }

  if (tx.status === "settled") {
    return;
  }

  const { error: updateError } = await getServiceClient()
    .from("transactions")
    .update({
      status: "settled",
      settled_at: new Date().toISOString(),
    })
    .eq("id", tx.id);

  if (updateError) {
    console.error("[nomba webhook] failed to settle transfer", {
      transactionId: tx.id,
      error: updateError.message,
    });
  }
}

async function handleTransferFailed(
  payload: NombaWebhookPayload,
): Promise<void> {
  const data = parseTransferEventData(payload.data);
  if (!data) {
    console.warn("[nomba webhook] invalid transfer.failed payload", {
      requestId: payload.requestId,
    });
    return;
  }

  const { data: tx, error: txError } = await getServiceClient()
    .from("transactions")
    .select("id, vault_id, status")
    .eq("nomba_tx_ref", data.merchantTxRef)
    .maybeSingle();

  if (txError) {
    console.error("[nomba webhook] transfer.failed lookup failed", {
      merchantTxRef: data.merchantTxRef,
      error: txError.message,
    });
    return;
  }

  if (!tx) {
    console.warn("[nomba webhook] no transaction for transfer.failed", {
      merchantTxRef: data.merchantTxRef,
      requestId: payload.requestId,
    });
    return;
  }

  if (tx.status === "failed") {
    return;
  }

  const refundResult = await incrementVaultBalanceKobo(tx.vault_id, data.amount);
  if (!refundResult.ok) {
    console.error("[nomba webhook] failed to refund vault balance", {
      vaultId: tx.vault_id,
      error: refundResult.error,
    });
    return;
  }

  const { error: updateError } = await getServiceClient()
    .from("transactions")
    .update({ status: "failed" })
    .eq("id", tx.id);

  if (updateError) {
    console.error("[nomba webhook] failed to mark transfer failed", {
      transactionId: tx.id,
      error: updateError.message,
    });
  }
}

async function processNombaEvent(payload: NombaWebhookPayload): Promise<void> {
  try {
    const inserted = await recordWebhookEvent(payload.requestId, payload.event);
    if (!inserted) {
      console.warn("[nomba webhook] duplicate requestId on process", {
        requestId: payload.requestId,
      });
      return;
    }

    switch (payload.event) {
      case "virtual_account.funded":
        await handleVaultFunded(payload);
        break;
      case "transfer.success":
        await handleTransferSuccess(payload);
        break;
      case "transfer.failed":
        await handleTransferFailed(payload);
        break;
      case "payment_success":
        console.info("[nomba webhook] payment_success received", {
          requestId: payload.requestId,
        });
        break;
      default:
        console.info("[nomba webhook] unhandled event type", {
          event: payload.event,
          requestId: payload.requestId,
        });
    }
  } catch (err) {
    console.error("[nomba webhook] processing error", {
      requestId: payload.requestId,
      event: payload.event,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());

  const signature = request.headers.get("nomba-signature");
  const expected = crypto
    .createHmac("sha256", getNombaWebhookSecret())
    .update(rawBody)
    .digest("hex");

  if (!signature || signature !== expected) {
    return new Response("bad signature", { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString());
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const payload = parseNombaPayload(parsed);
  if (!payload) {
    return new Response("invalid payload", { status: 400 });
  }

  if (await isDuplicateRequest(payload.requestId)) {
    return new Response("ok", { status: 200 });
  }

  after(async () => {
    await processNombaEvent(payload);
  });

  return new Response("ok", { status: 200 });
}
