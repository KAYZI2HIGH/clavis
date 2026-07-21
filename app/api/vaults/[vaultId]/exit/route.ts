import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { makeId } from "@/lib/vault-utils";

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
    return Response.json({ error: "Only the investor can request an exit" }, { status: 403 });
  }

  // Create an exit dispute/record
  const { error: insertErr } = await getServiceClient()
    .from("disputes")
    .insert({
      id: makeId("dsp"),
      vault_id: vaultId,
      raised_by: stakeholder.id,
      dispute_type: "settlement_error", // using as a proxy for exit request for now
      status: "open",
      created_at: new Date().toISOString(),
    });

  if (insertErr) {
    return Response.json({ error: "Failed to request exit" }, { status: 500 });
  }

  return Response.json({ success: true, message: "Exit request sent. Operators have 14 days to respond." });
}
