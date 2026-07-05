import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { createVirtualAccount } from "@/lib/nomba/accounts";
import { log } from "@/lib/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { vaultId } = await params;

  // Confirm founder
  const { data: vault } = await getServiceClient()
    .from("vaults")
    .select("*, stakeholders:stakeholders!stakeholders_vault_id_fkey(*)")
    .eq("id", vaultId)
    .maybeSingle();

  if (!vault || vault.status !== "draft") {
    log({
      level: "error",
      event: "vault_found_validation_failed",
      vaultId,
      error: !vault ? "Vault row not found" : `Vault status is ${vault.status} (expected draft)`
    });
    return Response.json(
      { error: "Vault not found or already active" },
      { status: 404 }
    );
  }

  const email = session.user.email;
  const phone = session.user.phone;

  const isFounder = vault.stakeholders?.some(
    (s: any) => 
      ((email && s.email === email) || (phone && s.phone === phone)) && 
      s.is_founder
  );

  if (!isFounder) {
    return Response.json(
      { error: "Only the founder can activate the vault" },
      { status: 403 }
    );
  }

  // Create Nomba virtual account
  let accountNumber = "";
  let bankName = "";

  try {
    const va = await createVirtualAccount({
      vaultId,
      vaultName: vault.name,
    });
    accountNumber = va.accountNumber;
    bankName = va.bankName;
  } catch (err) {
    log({
      level: "error",
      event: "vault_va_creation_failed",
      vaultId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Don't block — vault still activates without VA
  }

  // Activate vault
  await getServiceClient()
    .from("vaults")
    .update({
      status: "active",
      nomba_virtual_account_number: accountNumber || null,
      nomba_virtual_account_bank: bankName || null,
      funding_account: accountNumber || "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", vaultId);

  return Response.json({ 
    success: true,
    accountNumber,
    bankName,
  });
}
