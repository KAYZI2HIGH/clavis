import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ vaultId: string; id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultId, id } = await params;
  const email = session.user.email;
  const phone = session.user.phone;

  if (!email && !phone) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { decision } = body;

  if (decision !== "confirmed" && decision !== "reclassified") {
    return Response.json({ error: "Invalid decision" }, { status: 400 });
  }

  // Check investor status
  const { data: vault } = await getServiceClient()
    .from("vaults")
    .select("investor_id")
    .eq("id", vaultId)
    .single();

  if (!vault) return Response.json({ error: "Vault not found" }, { status: 404 });

  const { data: stakeholder } = await getServiceClient()
    .from("stakeholders")
    .select("id")
    .eq("vault_id", vaultId)
    .eq("id", vault.investor_id)
    .or(email && phone ? `email.eq.${email},phone.eq.${phone}` : email ? `email.eq.${email}` : `phone.eq.${phone}`)
    .single();

  if (!stakeholder) {
    return Response.json({ error: "Only the investor can review classifications" }, { status: 403 });
  }

  const { error: updateErr } = await getServiceClient()
    .from("inflow_classifications")
    .update({
      investor_reviewed: true,
      investor_decision: decision,
      flagged_for_review: false,
    })
    .eq("id", id)
    .eq("vault_id", vaultId);

  if (updateErr) {
    return Response.json({ error: "Failed to update classification" }, { status: 500 });
  }

  return Response.json({ success: true });
}
