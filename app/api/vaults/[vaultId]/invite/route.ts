import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { makeId } from "@/lib/vault-utils";
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

  let body: { email: string; name: string };
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
    return Response.json({ error: "Unauthorized to invite operators" }, { status: 403 });
  }

  if (!body.email || !body.name) {
    return Response.json({ error: "Email and Name are required" }, { status: 400 });
  }

  const invite_code = makeId("inv");

  const { error: insertError } = await getServiceClient()
    .from("vault_invites")
    .insert({
      id: makeId("vi"),
      vault_id: vaultId,
      invited_by: investor.id,
      email: body.email,
      invite_code,
      role: "operator",
      status: "pending",
    });

  if (insertError) {
    log({
      level: "error",
      event: "vault_invite_insert_failed",
      vaultId,
      error: insertError.message,
    });
    return Response.json({ error: "Failed to create invite" }, { status: 500 });
  }

  const invite_url = `${process.env.NEXTAUTH_URL}/join-vault?token=${invite_code}`;

  return Response.json({ invite_code, invite_url });
}
