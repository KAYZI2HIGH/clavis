import crypto from "crypto";
import { log } from "@/lib/logger";
import { nombaFetch } from "@/lib/nomba/client";

type RecipientLookupResponse = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
};

type TransferInitiationResponse = {
  reference: string;
};

export type RecipientLookupResult = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
};

export async function lookupRecipient({
  accountNumber,
  bankCode,
}: {
  accountNumber: string;
  bankCode: string;
}): Promise<RecipientLookupResult> {
  const merchantTxRef = crypto.randomUUID();

  const data = await nombaFetch<RecipientLookupResponse>(
    "/transfers/bank/lookup",
    {
      method: "POST",
      merchantTxRef,
      body: { bankCode, accountNumber },
    },
  );

  log({
    level: "info",
    event: "recipient_lookup",
    merchantTxRef,
    accountNumber,
    bankCode,
    resolvedName: data.accountName,
  });

  return {
    accountName: data.accountName,
    accountNumber: data.accountNumber,
    bankCode: data.bankCode,
  };
}

export async function initiateTransfer({
  amount,
  accountNumber,
  bankCode,
  narration,
  merchantTxRef,
  vaultName,
  vaultId,
}: {
  amount: number;
  accountNumber: string;
  bankCode: string;
  narration: string;
  merchantTxRef: string;
  vaultName?: string;
  vaultId?: string;
}): Promise<TransferInitiationResponse> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Amount must be a positive integer in kobo");
  }

  const recipient = await lookupRecipient({ accountNumber, bankCode });

  const senderName = vaultName ?? vaultId ?? "Clavis Vault";

  log({
    level: "info",
    event: "transfer_initiated",
    merchantTxRef,
    vaultId,
    amount,
    recipientName: recipient.accountName,
  });

  const data = await nombaFetch<TransferInitiationResponse>("/transfers/bank", {
    method: "POST",
    merchantTxRef,
    body: {
      amount,
      bankCode,
      accountNumber,
      accountName: recipient.accountName,
      senderName,
      narration,
      merchantTxRef,
    },
  });

  log({
    level: "info",
    event: "transfer_accepted",
    merchantTxRef,
    vaultId,
    nombaReference: data.reference,
  });

  return data;
}
