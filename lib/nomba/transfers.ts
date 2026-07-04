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

type NombaLookupEnvelope = {
  code: string;
  description: string;
  data: RecipientLookupResponse;
};

export async function lookupRecipient({
  accountNumber,
  bankCode,
}: {
  accountNumber: string;
  bankCode: string;
}): Promise<RecipientLookupResult> {
  const merchantTxRef = crypto.randomUUID();

  const response = await nombaFetch<NombaLookupEnvelope>(
    "/transfers/bank/lookup",
    {
      method: "POST",
      merchantTxRef,
      body: { bankCode, accountNumber },
    },
  );

  const data = response.data;

  log({
    level: "info",
    event: "recipient_lookup",
    merchantTxRef,
    accountNumber,
    bankCode,
    resolvedName: data?.accountName,
  });

  if (!data?.accountName) {
    throw new Error(response.description || "Recipient account details not found");
  }

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
  accountName,
  senderName,
  vaultId,
}: {
  amount: number;
  accountNumber: string;
  bankCode: string;
  narration: string;
  merchantTxRef: string;
  accountName?: string;
  senderName?: string;
  vaultId?: string;
}): Promise<TransferInitiationResponse> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Amount must be a positive integer in kobo");
  }

  const resolvedAccountName =
    accountName ||
    (await lookupRecipient({ accountNumber, bankCode })).accountName;

  const resolvedSenderName = senderName || "Clavis Vault";

  log({
    level: "info",
    event: "transfer_initiated",
    merchantTxRef,
    vaultId,
    amount,
    recipientName: resolvedAccountName,
  });

  const data = await nombaFetch<TransferInitiationResponse>("/transfers/bank", {
    method: "POST",
    merchantTxRef,
    body: {
      amount,
      bankCode,
      accountNumber,
      accountName: resolvedAccountName,
      senderName: resolvedSenderName,
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
