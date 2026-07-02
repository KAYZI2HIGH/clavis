import { createVirtualAccount } from "@/lib/nomba/accounts";
import { NombaApiError } from "@/lib/nomba/client";
import { log } from "@/lib/logger";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type VaultFundRow = {
  id: string;
  name: string;
  nomba_virtual_account_number: string | null;
  nomba_virtual_account_bank: string | null;
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ vaultId: string }> },
) {
  const { vaultId } = await context.params;

  const { data: vault, error } = await getServiceClient()
    .from("vaults")
    .select("id, name, nomba_virtual_account_number, nomba_virtual_account_bank")
    .eq("id", vaultId)
    .maybeSingle();

  if (error) {
    log({
      level: "error",
      event: "vault_fund_lookup_failed",
      vaultId,
      error: error.message,
    });
    return Response.json({ error: "Failed to load vault" }, { status: 500 });
  }

  if (!vault) {
    return Response.json({ error: "Vault not found" }, { status: 404 });
  }

  const row = vault as VaultFundRow;

  if (row.nomba_virtual_account_number) {
    return Response.json({
      accountNumber: row.nomba_virtual_account_number,
      bankName: row.nomba_virtual_account_bank ?? "",
    });
  }

  try {
    const account = await createVirtualAccount({
      vaultId: row.id,
      vaultName: row.name,
    });

    return Response.json({
      accountNumber: account.accountNumber,
      bankName: account.bankName,
    });
  } catch (err) {
    const message =
      err instanceof NombaApiError
        ? err.nombaMessage
        : err instanceof Error
          ? err.message
          : "Failed to create virtual account";

    log({
      level: "error",
      event: "vault_fund_create_failed",
      vaultId,
      error: message,
    });

    return Response.json({ error: message }, { status: 502 });
  }
}
