import { monnifyFetch } from "./client";
import { getMonnifyContractCode } from "./env";

export type CreateReservedAccountParams = {
  accountReference: string;
  accountName: string;
  customerEmail: string;
  customerName: string;
  bvn?: string;
  nin?: string;
};

export type MonnifyReservedAccount = {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export type CreateReservedAccountResponse = {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    accountReference: string;
    accountName: string;
    currencyCode: string;
    customerEmail: string;
    accounts: MonnifyReservedAccount[];
    status: string;
  };
};

export async function createReservedAccount({
  accountReference,
  accountName,
  customerEmail,
  customerName,
  bvn,
  nin,
}: CreateReservedAccountParams): Promise<CreateReservedAccountResponse> {
  const payload: Record<string, unknown> = {
    accountReference,
    accountName,
    currencyCode: "NGN",
    contractCode: getMonnifyContractCode(),
    customerEmail,
    customerName,
    getAllAvailableBanks: true,
  };

  if (bvn) payload.bvn = bvn;
  if (nin) payload.nin = nin;

  return monnifyFetch<CreateReservedAccountResponse>(
    "/api/v2/bank-transfer/reserved-accounts",
    {
      method: "POST",
      merchantTxRef: accountReference,
      body: payload,
    }
  );
}
