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
      event: "monnify_webhook_idempotency_check_failed",
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
      event: "monnify_webhook_event_persist_failed",
      merchantTxRef: requestId,
      eventType,
      error: error.message,
    });
    throw error;
  }

  log({
    level: "info",
    event: "monnify_webhook_event_recorded",
    merchantTxRef: requestId,
    eventType,
  });

  return true;
}

async function handleVaultFunded(
  event: MonnifyWebhookEvent,
  requestId: string
): Promise<void> {
  const data = parseTransactionEventData(event.eventData);
  if (!data) {
    log({
      level: "warn",
      event: "monnify_webhook_invalid_payload",
      merchantTxRef: requestId,
      eventType: event.eventType,
    });
    return;
  }

  // Account number is what identifies the vault
  const accountNumber =
    data.destinationAccountInformation?.accountNumber ||
    data.product?.reference ||
    "";

  if (!accountNumber) {
    log({
      level: "warn",
      event: "monnify_webhook_missing_account_number",
      merchantTxRef: data.transactionReference,
    });
    return;
  }

  const { data: vault, error: vaultError } = await getServiceClient()
    .from("vaults")
    .select("id, quorum, revenue_account_number, capital_account_number")
    .or(`revenue_account_number.eq.${accountNumber},capital_account_number.eq.${accountNumber}`)
    .maybeSingle();

  if (vaultError) {
    log({
      level: "error",
      event: "monnify_webhook_vault_lookup_failed",
      merchantTxRef: data.transactionReference,
      accountNumber,
      error: vaultError.message,
    });
    return;
  }

  if (!vault) {
    log({
      level: "warn",
      event: "monnify_webhook_vault_not_found",
      merchantTxRef: data.transactionReference,
      accountNumber,
    });
    return;
  }

  const { data: existingTx } = await getServiceClient()
    .from("transactions")
    .select("id")
    .eq("monnify_tx_ref", data.transactionReference)
    .maybeSingle();

  if (existingTx) {
    log({
      level: "warn",
      event: "monnify_webhook_duplicate_tx_ref",
      merchantTxRef: data.transactionReference,
      vaultId: vault.id,
    });
    return;
  }

  // Amount is in Naira from Monnify, we need Kobo
  const amountKobo = Math.round(data.amountPaid * 100);

  const balanceResult = await incrementVaultBalanceKobo(vault.id, amountKobo);
  if (!balanceResult.ok) {
    log({
      level: "error",
      event: "monnify_webhook_balance_update_failed",
      merchantTxRef: data.transactionReference,
      vaultId: vault.id,
      error: balanceResult.error,
    });
    return;
  }

  // Determine inflow type
  const accountType =
    accountNumber === vault.capital_account_number ? "capital" : "revenue";

  const now = new Date().toISOString();
  const { error: txError } = await getServiceClient().from("transactions").insert({
    id: makeId("TX"),
    vault_id: vault.id,
    recipient_name: "Vault funding",
    recipient_account: accountNumber,
    amount_kobo: amountKobo,
    memo: "Vault funded via Monnify",
    narration: data.paymentDescription || "Vault funded",
    requested_by: null,
    requested_at: now,
    status: "settled",
    required_quorum: vault.quorum,
    settled_at: now,
    monnify_tx_ref: data.transactionReference,
    inflow_account_type: accountType,
    is_inflow: true,
  });

  if (txError) {
    if (txError.code === "23505") {
      log({
        level: "warn",
        event: "monnify_webhook_duplicate_tx_ref_on_insert",
        merchantTxRef: data.transactionReference,
        vaultId: vault.id,
      });
      return;
    }
    log({
      level: "error",
      event: "monnify_webhook_funding_tx_insert_failed",
      merchantTxRef: data.transactionReference,
      vaultId: vault.id,
      error: txError.message,
    });
    return;
  }

  log({
    level: "info",
    event: "monnify_webhook_vault_funded",
    merchantTxRef: data.transactionReference,
    vaultId: vault.id,
    amountNaira: data.amountPaid,
    amountKobo,
    newBalance: balanceResult.newBalance,
    accountType,
  });
}

async function handleTransferSuccess(
  event: MonnifyWebhookEvent,
  requestId: string
): Promise<void> {
  const data = parseDisbursementEventData(event.eventData);
  if (!data) {
    log({
      level: "warn",
      event: "monnify_webhook_invalid_payload",
      merchantTxRef: requestId,
      eventType: event.eventType,
    });
    return;
  }

  const { data: tx, error: txError } = await getServiceClient()
    .from("transactions")
    .select("id, status")
    .eq("monnify_tx_ref", data.reference)
    .maybeSingle();

  if (txError) {
    log({
      level: "error",
      event: "monnify_webhook_transfer_success_lookup_failed",
      merchantTxRef: data.reference,
      error: txError.message,
    });
    return;
  }

  if (!tx) {
    log({
      level: "warn",
      event: "monnify_webhook_transfer_tx_not_found",
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
      event: "monnify_webhook_transfer_settle_failed",
      merchantTxRef: data.reference,
      transactionId: tx.id,
      error: updateError.message,
    });
    return;
  }

  log({
    level: "info",
    event: "monnify_webhook_transfer_settled",
    merchantTxRef: data.reference,
    transactionId: tx.id,
  });
}

async function handleTransferFailed(
  event: MonnifyWebhookEvent,
  requestId: string
): Promise<void> {
  const data = parseDisbursementEventData(event.eventData);
  if (!data) {
    log({
      level: "warn",
      event: "monnify_webhook_invalid_payload",
      merchantTxRef: requestId,
      eventType: event.eventType,
    });
    return;
  }

  const { data: tx, error: txError } = await getServiceClient()
    .from("transactions")
    .select("id, vault_id, status")
    .eq("monnify_tx_ref", data.reference)
    .maybeSingle();

  if (txError) {
    log({
      level: "error",
      event: "monnify_webhook_transfer_failed_lookup_failed",
      merchantTxRef: data.reference,
      error: txError.message,
    });
    return;
  }

  if (!tx) {
    log({
      level: "warn",
      event: "monnify_webhook_transfer_tx_not_found",
      merchantTxRef: data.reference,
    });
    return;
  }

  if (tx.status === "failed") {
    return;
  }

  // Reverse Kobo back into vault
  const refundAmountKobo = Math.round(data.amount * 100);
  const refundResult = await incrementVaultBalanceKobo(tx.vault_id, refundAmountKobo);
  if (!refundResult.ok) {
    log({
      level: "error",
      event: "monnify_webhook_transfer_refund_failed",
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
      event: "monnify_webhook_transfer_mark_failed_failed",
      merchantTxRef: data.reference,
      transactionId: tx.id,
      error: updateError.message,
    });
    return;
  }

  log({
    level: "info",
    event: "monnify_webhook_transfer_failed_refunded",
    merchantTxRef: data.reference,
    vaultId: tx.vault_id,
    amountNaira: data.amount,
    refundAmountKobo,
    newBalance: refundResult.newBalance,
  });
}

async function processMonnifyEvent(
  event: MonnifyWebhookEvent,
  requestId: string
): Promise<void> {
  try {
    const inserted = await recordWebhookEvent(requestId, event.eventType);
    if (!inserted) {
      log({
        level: "warn",
        event: "monnify_webhook_duplicate_request",
        merchantTxRef: requestId,
        eventType: event.eventType,
      });
      return;
    }

    switch (event.eventType) {
      case "SUCCESSFUL_TRANSACTION":
        await handleVaultFunded(event, requestId);
        break;
      case "SUCCESSFUL_DISBURSEMENT":
        await handleTransferSuccess(event, requestId);
        break;
      case "FAILED_DISBURSEMENT":
      case "REVERSED_DISBURSEMENT":
        await handleTransferFailed(event, requestId);
        break;
      default:
        log({
          level: "info",
          event: "monnify_webhook_unhandled_event",
          merchantTxRef: requestId,
          eventType: event.eventType,
        });
    }
  } catch (err) {
    log({
      level: "error",
      event: "monnify_webhook_processing_error",
      merchantTxRef: requestId,
      eventType: event.eventType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());

  const signature = request.headers.get("monnify-signature");

  if (!signature) {
    return new Response("missing headers", { status: 400 });
  }

  // Monnify computes HMAC-SHA512 of the raw body using the Client Secret
  const expected = crypto
    .createHmac("sha512", getMonnifySecretKey())
    .update(rawBody)
    .digest("hex");

  let signaturesMatch = false;
  try {
    // Both standard hex representations should be compared safely
    signaturesMatch = crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    // If length mismatch or invalid hex, catch block runs
    signaturesMatch = false;
  }

  if (!signaturesMatch) {
    return new Response("bad signature", { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString());
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const payload = parseMonnifyWebhookPayload(parsed);
  if (!payload) {
    return new Response("invalid payload", { status: 400 });
  }

  // Attempt to extract a unique request ID from the eventData
  const eventDataRaw = payload.eventData as Record<string, unknown>;
  const requestId = String(
    eventDataRaw.transactionReference ||
    eventDataRaw.reference ||
    eventDataRaw.paymentReference ||
    `unknown-${Date.now()}`
  );

  if (await isDuplicateRequest(requestId)) {
    return new Response("ok", { status: 200 });
  }

  after(async () => {
    await processMonnifyEvent(payload, requestId);
  });

  return new Response("ok", { status: 200 });
}
