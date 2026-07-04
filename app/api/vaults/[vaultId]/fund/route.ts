import { auth } from "@/auth";
import { createVirtualAccount } from "@/lib/nomba/accounts";
import { NombaApiError } from "@/lib/nomba/client";
import { log } from "@/lib/logger";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type VaultFundRow = {
  id: string;
  name: string;
  founder_id: string | null;
  nomba_virtual_account_number: string | null;
  nomba_virtual_account_bank: string | null;
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ vaultId: string }> },
) {
  // 1. Get session via auth() — return 401 if not authenticated
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultId } = await context.params;

  // 2. Fetch the vault from Supabase by vaultId
  const { data: vault, error } = await getServiceClient()
    .from("vaults")
    .select("id, name, founder_id, nomba_virtual_account_number, nomba_virtual_account_bank")
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

  const email = session.user.email;
  const phone = session.user.phone;

  // 3. Confirm the requesting user is the founder stakeholder
  const { data: founderRow, error: founderErr } = await getServiceClient()
    .from("stakeholders")
    .select("id")
    .eq("vault_id", vaultId)
    .eq("is_founder", true)
    .or(
      [email ? `email.eq.${email}` : null, phone ? `phone.eq.${phone}` : null]
        .filter(Boolean)
        .join(",")
    )
    .maybeSingle();

  if (founderErr || !founderRow) {
    log({
      level: "warn",
      event: "vault_fund_retry_unauthorized",
      vaultId,
      email,
      phone,
      error: founderErr?.message
    });
    return Response.json({ error: "Only the founder can retry VA setup" }, { status: 403 });
  }

  // 4. If vault already has nomba_virtual_account_number set, return immediately
  if (row.nomba_virtual_account_number) {
    return Response.json({
      accountNumber: row.nomba_virtual_account_number,
      bankName: row.nomba_virtual_account_bank ?? "",
    });
  }

  try {
    // 5. Call createVirtualAccount
    const account = await createVirtualAccount({
      vaultId: row.id,
      vaultName: row.name,
    });

    // 6. On success: Update vault row
    const { error: updateError } = await getServiceClient()
      .from("vaults")
      .update({
        nomba_virtual_account_number: account.accountNumber,
        nomba_virtual_account_bank: account.bankName,
        funding_account: account.accountNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", vaultId);

    if (updateError) {
      log({
        level: "error",
        event: "vault_fund_persist_failed",
        vaultId,
        error: updateError.message,
      });
      return Response.json({ error: "Failed to store virtual account details" }, { status: 500 });
    }

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

    // 7. On Nomba failure: Log the error with vaultId tagged and return 500
    log({
      level: "error",
      event: "vault_fund_create_failed",
      vaultId,
      error: message,
    });

    return Response.json({ error: "Failed to create virtual account" }, { status: 500 });
  }
}
