import { NombaApiError } from "@/lib/nomba/client";
import { initiateTransfer } from "@/lib/nomba/transfers";
import { log } from "@/lib/logger";
import {
  deductVaultBalanceKobo,
  incrementVaultBalanceKobo,
} from "@/lib/supabase/vault-balance";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type TransferRequestBody = {
  transactionId?: string;
};

type TransactionRow = {
  id: string;
  vault_id: string;
  recipient_name: string;
  recipient_account: string;
  recipient_bank_code: string | null;
  amount_kobo: number;
  memo: string;
  narration: string | null;
  status: string;
};

/** Quorum-reached transactions ready for Nomba execution. */
const EXECUTABLE_STATUSES = new Set(["sealed", "approved"]);

export async function POST(request: Request) {
  let body: TransferRequestBody;

  try {
    body = (await request.json()) as TransferRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transactionId = body.transactionId?.trim();
  if (!transactionId) {
    return Response.json({ error: "transactionId is required" }, { status: 400 });
  }

  const { data: tx, error: txError } = await getServiceClient()
    .from("transactions")
    .select(
      "id, vault_id, recipient_name, recipient_account, recipient_bank_code, amount_kobo, memo, narration, status",
    )
    .eq("id", transactionId)
    .maybeSingle();

  if (txError) {
    log({
      level: "error",
      event: "transfer_transaction_lookup_failed",
      merchantTxRef: transactionId,
      error: txError.message,
    });
    return Response.json({ error: "Failed to load transaction" }, { status: 500 });
  }

  if (!tx) {
    return Response.json({ error: "Transaction not found" }, { status: 404 });
  }

  const transaction = tx as TransactionRow;

  if (!EXECUTABLE_STATUSES.has(transaction.status)) {
    return Response.json(
      {
        error: `Transaction must be approved before transfer (current status: ${transaction.status})`,
      },
      { status: 409 },
    );
  }

  if (!transaction.recipient_bank_code) {
    return Response.json(
      { error: "Transaction is missing recipient bank code" },
      { status: 422 },
    );
  }

  const amountKobo = Number(transaction.amount_kobo);
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    return Response.json(
      { error: "Transaction amount must be a positive integer in kobo" },
      { status: 422 },
    );
  }

  const deductResult = await deductVaultBalanceKobo(
    transaction.vault_id,
    amountKobo,
  );

  if (!deductResult.ok) {
    log({
      level: "warn",
      event: "transfer_insufficient_balance",
      merchantTxRef: transaction.id,
      vaultId: transaction.vault_id,
      amount: amountKobo,
      error: deductResult.error,
    });
    return Response.json(
      { error: "Insufficient vault balance for this transfer" },
      { status: 409 },
    );
  }

  log({
    level: "info",
    event: "transfer_balance_deducted",
    merchantTxRef: transaction.id,
    vaultId: transaction.vault_id,
    amount: amountKobo,
    newBalance: deductResult.newBalance,
  });

  const { error: statusError } = await getServiceClient()
    .from("transactions")
    .update({
      status: "executing",
      nomba_tx_ref: transaction.id,
    })
    .eq("id", transaction.id);

  if (statusError) {
    await incrementVaultBalanceKobo(transaction.vault_id, amountKobo);
    log({
      level: "error",
      event: "transfer_status_update_failed",
      merchantTxRef: transaction.id,
      vaultId: transaction.vault_id,
      error: statusError.message,
    });
    return Response.json({ error: "Failed to update transaction status" }, { status: 500 });
  }

  const narration =
    transaction.narration?.trim() ||
    transaction.memo.trim() ||
    `Clavis payout to ${transaction.recipient_name}`;

  try {
    await initiateTransfer({
      amount: amountKobo,
      accountNumber: transaction.recipient_account,
      bankCode: transaction.recipient_bank_code,
      narration,
      merchantTxRef: transaction.id,
      vaultId: transaction.vault_id,
    });
  } catch (err) {
    await incrementVaultBalanceKobo(transaction.vault_id, amountKobo);
    await getServiceClient()
      .from("transactions")
      .update({ status: "sealed", nomba_tx_ref: null })
      .eq("id", transaction.id);

    const message =
      err instanceof NombaApiError
        ? err.nombaMessage
        : err instanceof Error
          ? err.message
          : "Transfer initiation failed";

    log({
      level: "error",
      event: "transfer_initiation_failed",
      merchantTxRef: transaction.id,
      vaultId: transaction.vault_id,
      error: message,
    });

    return Response.json({ error: message }, { status: 502 });
  }

  return Response.json({ status: "executing" });
}
