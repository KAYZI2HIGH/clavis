import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultId } = await params;

  const email = session.user.email;
  const phone = session.user.phone;
  if (!email && !phone) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Fetch vault
  const { data: vault, error: vaultError } = await getServiceClient()
    .from("vaults")
    .select("status, investor_id, revenue_account_number")
    .eq("id", vaultId)
    .single();

  if (vaultError || !vault) {
    return Response.json({ error: "Vault not found" }, { status: 404 });
  }

  // 2. Confirm status is "draft"
  if (vault.status !== "draft") {
    return Response.json({ error: "Vault is not in draft status" }, { status: 400 });
  }

  // 3. Confirm revenue_account_number exists (fund step must have been completed)
  if (!vault.revenue_account_number) {
    return Response.json({ error: "Vault must be funded before activation" }, { status: 400 });
  }

  // 4. Confirm requester is the vault investor
  const { data: investor, error: shError } = await getServiceClient()
    .from("stakeholders")
    .select("id")
    .eq("vault_id", vaultId)
    .eq("is_investor", true)
    .eq("id", vault.investor_id)
    .or(email && phone ? `email.eq.${email},phone.eq.${phone}` : email ? `email.eq.${email}` : `phone.eq.${phone}`)
    .single();

  if (shError || !investor) {
    return Response.json({ error: "Unauthorized to activate vault" }, { status: 403 });
  }

  // 5. Update vault status to "active"
  const { error: updateError } = await getServiceClient()
    .from("vaults")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", vaultId);

  if (updateError) {
    log({
      level: "error",
      event: "vault_activation_failed",
      vaultId,
      error: updateError.message,
    });
    return Response.json({ error: "Failed to activate vault" }, { status: 500 });
  }

  return Response.json({ success: true, vaultId });
}
