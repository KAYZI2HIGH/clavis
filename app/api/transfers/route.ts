import { NombaApiError } from "@/lib/nomba/client";
import { initiateTransfer } from "@/lib/nomba/transfers";
import { log } from "@/lib/logger";
import {
  deductVaultBalanceKobo,
  incrementVaultBalanceKobo,
} from "@/lib/supabase/vault-balance";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

import { lookupRecipient } from "@/lib/nomba/transfers";

type TransferRequestBody = {
  transactionId?: string;
  vaultId?: string;
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
  nomba_tx_ref: string;
};

export async function POST(request: Request) {
  let body: TransferRequestBody;

  try {
    body = (await request.json()) as TransferRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transactionId = body.transactionId?.trim();
  const reqVaultId = body.vaultId?.trim();
  if (!transactionId || !reqVaultId) {
    return Response.json({ error: "transactionId and vaultId are required" }, { status: 400 });
  }

  const { data: tx, error: txError } = await getServiceClient()
    .from("transactions")
    .select(
      "id, vault_id, recipient_name, recipient_account, recipient_bank_code, amount_kobo, memo, narration, status, nomba_tx_ref",
    )
    .eq("id", transactionId)
    .eq("vault_id", reqVaultId)
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

  if (transaction.status !== "executing") {
    return Response.json(
      {
        error: `Transaction must be in executing status before transfer (current status: ${transaction.status})`,
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

  // Fetch vault senderName
  const { data: vault, error: vaultError } = await getServiceClient()
    .from("vaults")
    .select("name")
    .eq("id", transaction.vault_id)
    .maybeSingle();

  if (vaultError || !vault) {
    return Response.json(
      { error: "Failed to load vault details" },
      { status: 500 }
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
      merchantTxRef: transaction.nomba_tx_ref,
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
    merchantTxRef: transaction.nomba_tx_ref,
    vaultId: transaction.vault_id,
    amount: amountKobo,
    newBalance: deductResult.newBalance,
  });

  const narration =
    transaction.narration?.trim() ||
    transaction.memo.trim() ||
    `Clavis payout to ${transaction.recipient_name}`;

  try {
    // Call lookupRecipient for fresh accountName
    const lookup = await lookupRecipient({
      accountNumber: transaction.recipient_account,
      bankCode: transaction.recipient_bank_code,
    });

    log({
      level: "info",
      event: "transfer_lookup_recipient_success",
      merchantTxRef: transaction.nomba_tx_ref,
      vaultId: transaction.vault_id,
      accountName: lookup.accountName,
    });

    await initiateTransfer({
      amount: amountKobo,
      accountNumber: transaction.recipient_account,
      bankCode: transaction.recipient_bank_code,
      accountName: lookup.accountName,
      senderName: vault.name,
      narration,
      merchantTxRef: transaction.nomba_tx_ref,
      vaultId: transaction.vault_id,
    });
  } catch (err) {
    // Refund balance on failure
    await incrementVaultBalanceKobo(transaction.vault_id, amountKobo);
    await getServiceClient()
      .from("transactions")
      .update({ status: "pending" })
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
      merchantTxRef: transaction.nomba_tx_ref,
      vaultId: transaction.vault_id,
      error: message,
    });

    return Response.json({ error: message }, { status: 502 });
  }

  return Response.json({ status: "executing" });
}
