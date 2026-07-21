import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * GET /api/invitations?token=XYZ
 * Looks up a link invitation token and returns vault info for the join page.
 * No auth required — the token IS the credential.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();

  if (!token) {
    return Response.json({ error: "Token is required" }, { status: 400 });
  }

  // Find the vault_invites row by token
  const { data: invite, error: inviteErr } = await getServiceClient()
    .from("vault_invites")
    .select("id, vault_id, invite_code, invited_by, status")
    .eq("invite_code", token)
    .single();

  if (inviteErr || !invite) {
    return Response.json({ error: "Invitation not found or expired" }, { status: 404 });
  }

  // Fetch vault info (allow draft vaults too — user can join during creation flow)
  const { data: vault, error: vaultErr } = await getServiceClient()
    .from("vaults")
    .select("id, name, quorum, status, founder_id, investment_type, investor_profit_share, investor_monthly_fixed, investor_return_cap, term_duration_months")
    .eq("id", invite.vault_id)
    .single();

  if (vaultErr || !vault) {
    return Response.json({ error: "Vault not found" }, { status: 404 });
  }

  // Fetch inviter (founder) name
  const { data: inviter } = await getServiceClient()
    .from("stakeholders")
    .select("id, name, initials")
    .eq("id", invite.invited_by)
    .single();

  // Fetch current stakeholders list
  const { data: stakeholdersData } = await getServiceClient()
    .from("stakeholders")
    .select("id, name, email, phone")
    .eq("vault_id", invite.vault_id);

  // Fetch standing orders
  const { data: standingOrdersData } = await getServiceClient()
    .from("standing_orders")
    .select("id, plain_language, action")
    .eq("vault_id", invite.vault_id)
    .neq("status", "deleted")
    .neq("status", "rejected");

  const stakeholderCount = stakeholdersData?.length ?? 1;

  return Response.json({
    invite: {
      id: invite.id,
      token: invite.invite_code,
      status: invite.status,
    },
    vault: {
      id: vault.id,
      name: vault.name,
      quorum: vault.quorum,
      status: vault.status,
      stakeholderCount,
      stakeholders: stakeholdersData ?? [],
      investmentTerms: {
        investment_type: vault.investment_type,
        investor_profit_share: vault.investor_profit_share,
        investor_monthly_fixed: vault.investor_monthly_fixed,
        investor_return_cap: vault.investor_return_cap,
        term_duration_months: vault.term_duration_months,
      },
      standingOrders: standingOrdersData ?? [],
    },
    inviter: inviter
      ? { id: inviter.id, name: inviter.name, initials: inviter.initials }
      : null,
  });
}

/**
 * POST /api/invitations
 * Records a pending join request when a user clicks "Request to Join".
 * Body: { token: string, name: string, userId: string }
 */
export async function POST(request: Request) {
  let body: { token?: string; name?: string; userId?: string; email?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, name, userId, email, phone } = body;
  if (!token || !name) {
    return Response.json({ error: "token and name are required" }, { status: 400 });
  }

  // Find the invitation
  const { data: invite, error: inviteErr } = await getServiceClient()
    .from("vault_invites")
    .select("id, vault_id, status")
    .eq("invite_code", token)
    .single();

  if (inviteErr || !invite) {
    return Response.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invite.status !== "pending") {
    return Response.json({ error: "This invitation is no longer active" }, { status: 409 });
  }

  // Check if this stakeholder already exists for this vault
  const { data: existing } = await getServiceClient()
    .from("stakeholders")
    .select("id")
    .eq("vault_id", invite.vault_id)
    .or(
      [
        body.email ? `email.eq.${body.email}` : null,
        body.phone ? `phone.eq.${body.phone}` : null,
        `name.eq.${name}`
      ]
        .filter(Boolean)
        .join(",")
    )
    .maybeSingle();

  if (existing) {
    return Response.json({ ok: true, alreadyStakeholder: true });
  }

  const initials = name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const { error: insertErr } = await getServiceClient().from("stakeholders").insert({
    id: `sh-${Math.random().toString(36).slice(2, 10)}`,
    vault_id: invite.vault_id,
    name,
    initials,
    email: body.email || null,
    phone: body.phone || null,
    is_founder: false,
    created_at: new Date().toISOString(),
  });

  if (insertErr) {
    return Response.json({ error: "Failed to join vault" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
