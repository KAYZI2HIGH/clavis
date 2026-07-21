import { monnifyFetch } from "./client";
import { getMonnifyWalletAccountNumber } from "./env";

export type InitiateTransferParams = {
  amountKobo: number; // NOTE: MUST BE KOBO, will be divided by 100 for Monnify
  reference: string;
  narration: string;
  destinationBankCode: string;
  destinationAccountNumber: string;
  destinationAccountName?: string;
};

export type MonnifyTransferResponse = {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    reference: string;
    status: string;
    amount: number;
    fee: number;
    currency: string;
    destinationAccountNumber: string;
    destinationBankCode: string;
  };
};

export async function initiateTransfer(
  params: InitiateTransferParams
): Promise<MonnifyTransferResponse> {
  // Convert kobo to Naira for Monnify API
  const amountNaira = params.amountKobo / 100;

  const payload: Record<string, unknown> = {
    amount: amountNaira,
    reference: params.reference,
    narration: params.narration,
    destinationBankCode: params.destinationBankCode,
    destinationAccountNumber: params.destinationAccountNumber,
    currency: "NGN",
    sourceAccountNumber: getMonnifyWalletAccountNumber(),
    async: true,
  };

  if (params.destinationAccountName) {
    payload.destinationAccountName = params.destinationAccountName;
  }

  return monnifyFetch<MonnifyTransferResponse>(
    "/api/v2/disbursements/single",
    {
      method: "POST",
      merchantTxRef: params.reference,
      body: payload,
    }
  );
}

export type MonnifyAccountValidationResponse = {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    accountNumber: string;
    accountName: string;
    bankCode: string;
  };
};

export async function validateBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<{ accountName: string; accountNumber: string; bankCode: string }> {
  const res = await monnifyFetch<MonnifyAccountValidationResponse>(
    `/api/v2/disbursements/account/validate?accountNumber=${accountNumber}&bankCode=${bankCode}`,
    {
      method: "GET",
      merchantTxRef: `VAL-${accountNumber}-${bankCode}-${Date.now()}`,
    }
  );

  if (!res.requestSuccessful || !res.responseBody?.accountName) {
    throw new Error(res.responseMessage || "Failed to validate account details");
  }

  return res.responseBody;
}
