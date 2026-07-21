import crypto from "crypto";
import { after } from "next/server";
import { log } from "@/lib/logger";
import { getMonnifySecretKey } from "@/lib/monnify/env";
import {
  parseMonnifyWebhookPayload,
  parseTransactionEventData,
  parseDisbursementEventData,
  type MonnifyWebhookEvent,
} from "@/lib/monnify/webhook-types";
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
  payload: MonnifyWebhookEvent,
): Promise<void> {
  const data = parseTransactionEventData(payload.eventData);
  if (!data) {
    log({
      level: "warn",
      event: "webhook_invalid_payload",
      merchantTxRef: "unknown",
      eventType: payload.eventType,
    });
    return;
  }

  const accountNumber = data.destinationAccountInformation?.accountNumber;
  if (!accountNumber) {
    log({
      level: "warn",
      event: "webhook_missing_account_number",
      merchantTxRef: data.transactionReference,
      eventType: payload.eventType,
    });
    return;
  }

  const { data: vault, error: vaultError } = await getServiceClient()
    .from("vaults")
    .select("id, quorum")
    .eq("nomba_virtual_account_number", accountNumber) // using the same DB column mapping
    .maybeSingle();

  if (vaultError) {
    log({
      level: "error",
      event: "webhook_vault_lookup_failed",
      merchantTxRef: data.transactionReference,
      accountNumber,
      error: vaultError.message,
    });
    return;
  }

  if (!vault) {
    log({
      level: "warn",
      event: "webhook_vault_not_found",
      merchantTxRef: data.transactionReference,
      accountNumber,
    });
    return;
  }

  const { data: existingTx } = await getServiceClient()
    .from("transactions")
    .select("id")
    .eq("nomba_tx_ref", data.transactionReference)
    .maybeSingle();

  if (existingTx) {
    log({
      level: "warn",
      event: "webhook_duplicate_tx_ref",
      merchantTxRef: data.transactionReference,
      vaultId: vault.id,
    });
    return;
  }

  const amountKobo = Math.round(data.amountPaid * 100);

  const balanceResult = await incrementVaultBalanceKobo(vault.id, amountKobo);
  if (!balanceResult.ok) {
    log({
      level: "error",
      event: "webhook_balance_update_failed",
      merchantTxRef: data.transactionReference,
      vaultId: vault.id,
      error: balanceResult.error,
    });
    return;
  }

  const now = new Date().toISOString();
  const { error: txError } = await getServiceClient().from("transactions").insert({
    id: makeId("TX"),
    vault_id: vault.id,
    recipient_name: data.customer?.name || "Vault funding",
    recipient_account: accountNumber,
    amount_kobo: amountKobo,
    memo: data.paymentDescription || "Vault funded via Monnify",
    narration: "Vault funded",
    requested_by: null,
    requested_at: now,
    status: "settled",
    required_quorum: vault.quorum,
    settled_at: now,
    nomba_tx_ref: data.transactionReference, // Storing Monnify reference here
  });

  if (txError) {
    if (txError.code === "23505") {
      log({
        level: "warn",
        event: "webhook_duplicate_tx_ref_on_insert",
        merchantTxRef: data.transactionReference,
        vaultId: vault.id,
      });
      return;
    }
    log({
      level: "error",
      event: "webhook_funding_tx_insert_failed",
      merchantTxRef: data.transactionReference,
      vaultId: vault.id,
      error: txError.message,
    });
    return;
  }

  log({
    level: "info",
    event: "webhook_vault_funded",
    merchantTxRef: data.transactionReference,
    vaultId: vault.id,
    amount: data.amountPaid,
    newBalance: balanceResult.newBalance,
  });
}

async function handleDisbursementSuccess(
  payload: MonnifyWebhookEvent,
): Promise<void> {
  const data = parseDisbursementEventData(payload.eventData);
  if (!data) {
    log({
      level: "warn",
      event: "webhook_invalid_payload",
      merchantTxRef: "unknown",
      eventType: payload.eventType,
    });
    return;
  }

  const { data: tx, error: txError } = await getServiceClient()
    .from("transactions")
    .select("id, status")
    .eq("nomba_tx_ref", data.reference)
    .maybeSingle();

  if (txError) {
    log({
      level: "error",
      event: "webhook_transfer_success_lookup_failed",
      merchantTxRef: data.reference,
      error: txError.message,
    });
    return;
  }

  if (!tx) {
    log({
      level: "warn",
      event: "webhook_transfer_tx_not_found",
      merchantTxRef: data.reference,
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
      merchantTxRef: data.reference,
      transactionId: tx.id,
      error: updateError.message,
    });
    return;
  }

  log({
    level: "info",
    event: "webhook_transfer_settled",
    merchantTxRef: data.reference,
    transactionId: tx.id,
  });
}

async function handleDisbursementFailed(
  payload: MonnifyWebhookEvent,
): Promise<void> {
  const data = parseDisbursementEventData(payload.eventData);
  if (!data) {
    log({
      level: "warn",
      event: "webhook_invalid_payload",
      merchantTxRef: "unknown",
      eventType: payload.eventType,
    });
    return;
  }

  const { data: tx, error: txError } = await getServiceClient()
    .from("transactions")
    .select("id, vault_id, status")
    .eq("nomba_tx_ref", data.reference)
    .maybeSingle();

  if (txError) {
    log({
      level: "error",
      event: "webhook_transfer_failed_lookup_failed",
      merchantTxRef: data.reference,
      error: txError.message,
    });
    return;
  }

  if (!tx) {
    log({
      level: "warn",
      event: "webhook_transfer_tx_not_found",
      merchantTxRef: data.reference,
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
      merchantTxRef: data.reference,
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
      merchantTxRef: data.reference,
      transactionId: tx.id,
      error: updateError.message,
    });
    return;
  }

  log({
    level: "info",
    event: "webhook_transfer_failed_refunded",
    merchantTxRef: data.reference,
    vaultId: tx.vault_id,
    amount: data.amount,
    newBalance: refundResult.newBalance,
  });
}

async function processMonnifyEvent(payload: MonnifyWebhookEvent): Promise<void> {
  // Extract a stable requestId for idempotency
  let requestId = "";
  if (payload.eventType === "SUCCESSFUL_TRANSACTION") {
    const data = parseTransactionEventData(payload.eventData);
    requestId = data?.transactionReference || `TX-${Date.now()}`;
  } else if (payload.eventType.includes("DISBURSEMENT")) {
    const data = parseDisbursementEventData(payload.eventData);
    requestId = data?.reference || `DSB-${Date.now()}`;
  } else {
    requestId = `EVT-${Date.now()}`;
  }

  try {
    const inserted = await recordWebhookEvent(requestId, payload.eventType);
    if (!inserted) {
      log({
        level: "warn",
        event: "webhook_duplicate_request",
        merchantTxRef: requestId,
        eventType: payload.eventType,
      });
      return;
    }

    switch (payload.eventType) {
      case "SUCCESSFUL_TRANSACTION":
        await handleVaultFunded(payload);
        break;
      case "SUCCESSFUL_DISBURSEMENT":
        await handleDisbursementSuccess(payload);
        break;
      case "FAILED_DISBURSEMENT":
      case "REVERSED_DISBURSEMENT":
        await handleDisbursementFailed(payload);
        break;
      default:
        log({
          level: "info",
          event: "webhook_unhandled_event",
          merchantTxRef: requestId,
          eventType: payload.eventType,
        });
    }
  } catch (err) {
    log({
      level: "error",
      event: "webhook_processing_error",
      merchantTxRef: requestId,
      eventType: payload.eventType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("monnify-signature");

  if (!signature) {
    return new Response("missing headers", { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac("sha512", getMonnifySecretKey())
    .update(rawBody)
    .digest("hex");

  if (signature !== expectedSignature) {
    return new Response("bad signature", { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const payload = parseMonnifyWebhookPayload(parsed);
  if (!payload) {
    return new Response("invalid payload", { status: 400 });
  }

  after(async () => {
    await processMonnifyEvent(payload);
  });

  return new Response("ok", { status: 200 });
}
