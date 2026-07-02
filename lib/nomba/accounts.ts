import crypto from "crypto";
import { log } from "@/lib/logger";
import { nombaFetch } from "@/lib/nomba/client";
import { getServiceClient } from "@/lib/supabase/service";

type VirtualAccountResponse = {
  code?: string;
  description?: string;
  message?: string;
  status?: boolean;
  data?: {
    bankAccountNumber?: string;
    bankAccountName?: string;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    accountRef?: string;
  };
};

export type CreateVirtualAccountResult = {
  accountNumber: string;
  bankName: string;
  accountRef: string;
};

export async function createVirtualAccount({
  vaultId,
  vaultName,
}: {
  vaultId: string;
  vaultName: string;
}): Promise<CreateVirtualAccountResult> {
  const accountRef = crypto.randomUUID();

  try {
    const data = await nombaFetch<VirtualAccountResponse>("/accounts/virtual", {
      method: "POST",
      merchantTxRef: accountRef,
      body: {
        accountRef,
        accountName: vaultName,
      },
    });

    const accountNumber =
      data.data?.bankAccountNumber ?? data.data?.accountNumber ?? "";
    const bankName = data.data?.bankName ?? "";

    log({
      level: "info",
      event: "vault_virtual_account_nomba_response",
      merchantTxRef: accountRef,
      vaultId,
      response: data,
    });

    if (!accountNumber || !bankName) {
      log({
        level: "error",
        event: "vault_virtual_account_invalid_response",
        merchantTxRef: accountRef,
        vaultId,
        error: "Missing bankAccountNumber or bankName in Nomba response",
      });
      throw new Error(
        "Nomba virtual account response is missing account details",
      );
    }

    const { error } = await getServiceClient()
      .from("vaults")
      .update({
        nomba_virtual_account_number: accountNumber,
        nomba_virtual_account_bank: bankName,
      })
      .eq("id", vaultId);

    if (error) {
      log({
        level: "error",
        event: "vault_virtual_account_persist_failed",
        merchantTxRef: accountRef,
        vaultId,
        accountNumber,
        error: error.message,
      });
      throw new Error(`Failed to store virtual account for vault ${vaultId}`);
    }

    log({
      level: "info",
      event: "vault_virtual_account_created",
      merchantTxRef: accountRef,
      vaultId,
      accountNumber,
      bankName,
    });

    return {
      accountNumber,
      bankName,
      accountRef,
    };
  } catch (error) {
    log({
      level: "error",
      event: "vault_virtual_account_failed",
      merchantTxRef: accountRef,
      vaultId,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}
