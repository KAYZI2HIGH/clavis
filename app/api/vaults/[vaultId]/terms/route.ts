import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultId } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = session.user.email;
  const phone = session.user.phone;
  if (!email && !phone) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Fetch vault and confirm status is draft
  const { data: vault, error: vaultError } = await getServiceClient()
    .from("vaults")
    .select("status, investor_id")
    .eq("id", vaultId)
    .single();

  if (vaultError || !vault) {
    return Response.json({ error: "Vault not found" }, { status: 404 });
  }

  if (vault.status !== "draft") {
    return Response.json({ error: "Vault is no longer in draft status" }, { status: 400 });
  }

  // 2. Confirm requester is the vault investor
  const { data: investor, error: shError } = await getServiceClient()
    .from("stakeholders")
    .select("id")
    .eq("vault_id", vaultId)
    .eq("is_investor", true)
    .eq("id", vault.investor_id)
    .or(email && phone ? `email.eq.${email},phone.eq.${phone}` : email ? `email.eq.${email}` : `phone.eq.${phone}`)
    .single();

  if (shError || !investor) {
    return Response.json({ error: "Unauthorized to modify terms" }, { status: 403 });
  }

  // 3. Update vault with terms
  const updates = {
    investment_type: body.investment_type,
    investor_profit_share: body.investor_profit_share ?? null,
    investor_monthly_fixed: body.investor_monthly_fixed ?? null,
    investor_return_cap: body.investor_return_cap ?? null,
    term_duration_months: body.term_duration_months ?? null,
    settlement_day: body.settlement_day,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await getServiceClient()
    .from("vaults")
    .update(updates)
    .eq("id", vaultId);

  if (updateError) {
    log({
      level: "error",
      event: "vault_terms_update_failed",
      vaultId,
      error: updateError.message,
    });
    return Response.json({ error: "Failed to update terms" }, { status: 500 });
  }

  // 4. Insert into investment_terms_history
  await getServiceClient()
    .from("investment_terms_history")
    .insert({
      vault_id: vaultId,
      changed_by: investor.id,
      previous_terms: null,
      new_terms: body,
      reason: "Initial terms set",
    });

  return Response.json({ success: true });
}
