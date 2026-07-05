import crypto from "crypto";
import { after } from "next/server";
import { log } from "@/lib/logger";
import { getNombaWebhookSecret } from "@/lib/nomba/env";
import {
  parseNombaPayload,
  parseTransferEventData,
  parseVirtualAccountFundedData,
  type NombaWebhookPayload,
} from "@/lib/nomba/webhook-types";
import { incrementVaultBalanceKobo } from "@/lib/supabase/vault-balance";
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
    log({
      level: "error",
      event: "webhook_idempotency_check_failed",
      merchantTxRef: requestId,
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
    log({
      level: "error",
      event: "webhook_event_persist_failed",
      merchantTxRef: requestId,
      eventType,
      error: error.message,
    });
    throw error;
  }

  log({
    level: "info",
    event: "webhook_event_recorded",
    merchantTxRef: requestId,
    eventType,
  });

  return true;
}

async function handleVaultFunded(
  payload: NombaWebhookPayload,
): Promise<void> {
  const data = parseVirtualAccountFundedData(payload.data);
  if (!data) {
    log({
      level: "warn",
      event: "webhook_invalid_payload",
      merchantTxRef: payload.requestId,
      eventType: payload.event,
    });
    return;
  }

  const { data: vault, error: vaultError } = await getServiceClient()
    .from("vaults")
    .select("id, quorum")
    .eq("nomba_virtual_account_number", data.accountNumber)
    .maybeSingle();

  if (vaultError) {
    log({
      level: "error",
      event: "webhook_vault_lookup_failed",
      merchantTxRef: data.merchantTxRef,
      accountNumber: data.accountNumber,
      error: vaultError.message,
    });
    return;
  }

  if (!vault) {
    log({
      level: "warn",
      event: "webhook_vault_not_found",
      merchantTxRef: data.merchantTxRef,
      accountNumber: data.accountNumber,
    });
    return;
  }

  const { data: existingTx } = await getServiceClient()
    .from("transactions")
    .select("id")
    .eq("nomba_tx_ref", data.merchantTxRef)
    .maybeSingle();

  if (existingTx) {
    log({
      level: "warn",
      event: "webhook_duplicate_tx_ref",
      merchantTxRef: data.merchantTxRef,
      vaultId: vault.id,
    });
    return;
  }

  const amountKobo = Math.round(data.amount * 100);

  const balanceResult = await incrementVaultBalanceKobo(vault.id, amountKobo);
  if (!balanceResult.ok) {
    log({
      level: "error",
      event: "webhook_balance_update_failed",
      merchantTxRef: data.merchantTxRef,
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
    amount_kobo: amountKobo,
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
      log({
        level: "warn",
        event: "webhook_duplicate_tx_ref_on_insert",
        merchantTxRef: data.merchantTxRef,
        vaultId: vault.id,
      });
      return;
    }
    log({
      level: "error",
      event: "webhook_funding_tx_insert_failed",
      merchantTxRef: data.merchantTxRef,
      vaultId: vault.id,
      error: txError.message,
    });
    return;
  }

  log({
    level: "info",
    event: "webhook_vault_funded",
    merchantTxRef: data.merchantTxRef,
    vaultId: vault.id,
    amount: data.amount,
    newBalance: balanceResult.newBalance,
  });
}

async function handleTransferSuccess(
  payload: NombaWebhookPayload,
): Promise<void> {
  const data = parseTransferEventData(payload.data);
  if (!data) {
    log({
      level: "warn",
      event: "webhook_invalid_payload",
      merchantTxRef: payload.requestId,
      eventType: payload.event,
    });
    return;
  }

  const { data: tx, error: txError } = await getServiceClient()
    .from("transactions")
    .select("id, status")
    .eq("nomba_tx_ref", data.merchantTxRef)
    .maybeSingle();

  if (txError) {
    log({
      level: "error",
      event: "webhook_transfer_success_lookup_failed",
      merchantTxRef: data.merchantTxRef,
      error: txError.message,
    });
    return;
  }

  if (!tx) {
    log({
      level: "warn",
      event: "webhook_transfer_tx_not_found",
      merchantTxRef: data.merchantTxRef,
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
    log({
      level: "error",
      event: "webhook_transfer_settle_failed",
      merchantTxRef: data.merchantTxRef,
      transactionId: tx.id,
      error: updateError.message,
    });
    return;
  }

  log({
    level: "info",
    event: "webhook_transfer_settled",
    merchantTxRef: data.merchantTxRef,
    transactionId: tx.id,
  });
}

async function handleTransferFailed(
  payload: NombaWebhookPayload,
): Promise<void> {
  const data = parseTransferEventData(payload.data);
  if (!data) {
    log({
      level: "warn",
      event: "webhook_invalid_payload",
      merchantTxRef: payload.requestId,
      eventType: payload.event,
    });
    return;
  }

  const { data: tx, error: txError } = await getServiceClient()
    .from("transactions")
    .select("id, vault_id, status")
    .eq("nomba_tx_ref", data.merchantTxRef)
    .maybeSingle();

  if (txError) {
    log({
      level: "error",
      event: "webhook_transfer_failed_lookup_failed",
      merchantTxRef: data.merchantTxRef,
      error: txError.message,
    });
    return;
  }

  if (!tx) {
    log({
      level: "warn",
      event: "webhook_transfer_tx_not_found",
      merchantTxRef: data.merchantTxRef,
    });
    return;
  }

  if (tx.status === "failed") {
    return;
  }

  const refundAmountKobo = Math.round(data.amount * 100);
  const refundResult = await incrementVaultBalanceKobo(tx.vault_id, refundAmountKobo);
  if (!refundResult.ok) {
    log({
      level: "error",
      event: "webhook_transfer_refund_failed",
      merchantTxRef: data.merchantTxRef,
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
    log({
      level: "error",
      event: "webhook_transfer_mark_failed_failed",
      merchantTxRef: data.merchantTxRef,
      transactionId: tx.id,
      error: updateError.message,
    });
    return;
  }

  log({
    level: "info",
    event: "webhook_transfer_failed_refunded",
    merchantTxRef: data.merchantTxRef,
    vaultId: tx.vault_id,
    amount: data.amount,
    newBalance: refundResult.newBalance,
  });
}

async function processNombaEvent(payload: NombaWebhookPayload): Promise<void> {
  try {
    const inserted = await recordWebhookEvent(payload.requestId, payload.event);
    if (!inserted) {
      log({
        level: "warn",
        event: "webhook_duplicate_request",
        merchantTxRef: payload.requestId,
        eventType: payload.event,
      });
      return;
    }

    switch (payload.event) {
      case "payment_success":
        await handleVaultFunded(payload);
        break;
      case "payout_success":
        await handleTransferSuccess(payload);
        break;
      case "payout_failed":
        await handleTransferFailed(payload);
        break;
      default:
        log({
          level: "info",
          event: "webhook_unhandled_event",
          merchantTxRef: payload.requestId,
          eventType: payload.event,
        });
    }
  } catch (err) {
    log({
      level: "error",
      event: "webhook_processing_error",
      merchantTxRef: payload.requestId,
      eventType: payload.event,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());

  const signature = request.headers.get("nomba-signature");
  const timestamp = request.headers.get("nomba-timestamp");

  if (!signature || !timestamp) {
    return new Response("missing headers", { status: 400 });
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawBody.toString());
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const payload = parseNombaPayload(parsed);
  if (!payload) {
    return new Response("invalid payload", { status: 400 });
  }

  // Construct the colon-separated signature payload formatted string
  // Format: {event_type}:{requestId}:{userId}:{walletId}:{transactionId}:{type}:{time}:{responseCode}:{timestamp}
  const data = parsed.data || {};
  const merchant = data.merchant || {};
  const transaction = data.transaction || {};

  const eventType = parsed.event_type || "";
  const requestId = parsed.requestId || "";
  const userId = merchant.userId || "";
  const walletId = merchant.walletId || "";
  const transactionId = transaction.transactionId || "";
  const txType = transaction.type || "";
  const txTime = transaction.time || "";
  let responseCode = transaction.responseCode || "";
  if (responseCode === "null") {
    responseCode = "";
  }

  const hashingPayload = `${eventType}:${requestId}:${userId}:${walletId}:${transactionId}:${txType}:${txTime}:${responseCode}:${timestamp}`;

  const expected = crypto
    .createHmac("sha256", getNombaWebhookSecret())
    .update(hashingPayload)
    .digest("base64");

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);

  let signaturesMatch = false;
  try {
    signaturesMatch = crypto.timingSafeEqual(sigBuffer, expBuffer);
  } catch {
    signaturesMatch = false;
  }

  if (!signaturesMatch) {
    return new Response("bad signature", { status: 401 });
  }

  if (await isDuplicateRequest(payload.requestId)) {
    return new Response("ok", { status: 200 });
  }

  after(async () => {
    await processNombaEvent(payload);
  });

  return new Response("ok", { status: 200 });
}
