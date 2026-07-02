import crypto from "crypto";
import { log } from "@/lib/logger";
import { nombaFetch } from "@/lib/nomba/client";
import { getServiceClient } from "@/lib/supabase/service";

type VirtualAccountResponse = {
  accountNumber: string;
  bankName: string;
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

  const data = await nombaFetch<VirtualAccountResponse>("/accounts/virtual", {
    method: "POST",
    merchantTxRef: accountRef,
    body: {
      accountRef,
      accountName: vaultName,
    },
  });

  const { error } = await getServiceClient()
    .from("vaults")
    .update({
      nomba_virtual_account_number: data.accountNumber,
      nomba_virtual_account_bank: data.bankName,
    })
    .eq("id", vaultId);

  if (error) {
    log({
      level: "error",
      event: "vault_virtual_account_persist_failed",
      merchantTxRef: accountRef,
      vaultId,
      accountNumber: data.accountNumber,
      error: error.message,
    });
    throw new Error(`Failed to store virtual account for vault ${vaultId}`);
  }

  log({
    level: "info",
    event: "vault_virtual_account_created",
    merchantTxRef: accountRef,
    vaultId,
    accountNumber: data.accountNumber,
    bankName: data.bankName,
  });

  return {
    accountNumber: data.accountNumber,
    bankName: data.bankName,
    accountRef,
  };
}
