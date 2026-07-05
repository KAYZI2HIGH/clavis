import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { createVirtualAccount } from "@/lib/nomba/accounts";
import { log } from "@/lib/logger";
import { makeId } from "@/lib/vault-utils";

export const runtime = "nodejs";

/**
 * PATCH /api/vaults/[vaultId]
 * "Found the vault" — transitions a draft vault to active.
 * Body: { quorum: number, emailStakeholders?: {name,email,initials}[] }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ vaultId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultId } = await params;
  const body = await request.json().catch(() => ({}));
  const quorum = Number(body.quorum);

  if (isNaN(quorum) || quorum < 1) {
    return Response.json({ error: "Valid quorum is required" }, { status: 400 });
  }

  // Retrieve the vault to check its state
  const { data: vault, error: vaultLookupError } = await getServiceClient()
    .from("vaults")
    .select("status, founder_id")
    .eq("id", vaultId)
    .maybeSingle();

  if (vaultLookupError || !vault) {
    return Response.json({ error: "Vault not found" }, { status: 404 });
  }

  const email = session.user.email;
  const phone = session.user.phone;

  // Confirm user is founder
  const { data: founder } = await getServiceClient()
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

  if (!founder) {
    return Response.json(
      { error: "Only the founder can update quorum" },
      { status: 403 }
    );
  }

  // If vault is draft, we only update the quorum and return early
  if (vault.status === "draft") {
    await getServiceClient()
      .from("vaults")
      .update({
        quorum,
        updated_at: new Date().toISOString(),
      })
      .eq("id", vaultId);

    return Response.json({ quorum });
  }

  // Otherwise fallback to original PATCH active transition behaviour (for backwards compatibility if any)
  const founderStakeholderId = founder.id;

  // Write any pending email invites (method=email path)
  const emailStakeholders = body.emailStakeholders ?? [];
  for (const sh of emailStakeholders) {
    await getServiceClient().from("email_invites").insert({
      id: makeId("ei"),
      vault_id: vaultId,
      name: sh.name,
      email: sh.email,
      initials: sh.initials,
      invited_by: founderStakeholderId,
      status: "pending",
      created_at: new Date().toISOString(),
    });
  }

  // Flip vault to active with the chosen quorum
  const { error: updateErr } = await getServiceClient()
    .from("vaults")
    .update({
      status: "active",
      quorum,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vaultId);

  if (updateErr) {
    log({ level: "error", event: "vault_found_update_failed", vaultId, error: updateErr.message });
    return Response.json({ error: "Failed to found vault" }, { status: 500 });
  }

  // Re-fetch vault to check Nomba VA status
  const { data: vaultRow } = await getServiceClient()
    .from("vaults")
    .select("funding_account, name, nomba_virtual_account_number")
    .eq("id", vaultId)
    .single();

  // If VA wasn't created during the draft phase, retry now
  if (!vaultRow?.nomba_virtual_account_number) {
    createVirtualAccount({ vaultId, vaultName: vaultRow?.name ?? "" }).catch((err) => {
      log({
        level: "error",
        event: "vault_found_nomba_failed",
        vaultId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // Fetch full vault data to return
  const [stakeholdersRes, linkInvitesRes, emailInvitesRes, pendingJoinsRes, vaultRes] =
    await Promise.all([
      getServiceClient().from("stakeholders").select("*").eq("vault_id", vaultId),
      getServiceClient().from("link_invitations").select("*").eq("vault_id", vaultId),
      getServiceClient().from("email_invites").select("*").eq("vault_id", vaultId),
      getServiceClient().from("pending_joins").select("*").eq("vault_id", vaultId),
      getServiceClient().from("vaults").select("*").eq("id", vaultId).single(),
    ]);

  const v = vaultRes.data!;
  const stakeholders = (stakeholdersRes.data ?? []).map((sh) => ({
    id: sh.id,
    name: sh.name,
    initials: sh.initials,
    email: sh.email ?? undefined,
    phone: sh.phone ?? undefined,
    isFounder: sh.is_founder,
  }));

  const myStakeholder = stakeholders.find(
    (sh) => (email && sh.email === email) || (phone && sh.phone === phone),
  );

  return Response.json({
    id: v.id,
    name: v.name,
    quorum: v.quorum,
    status: "active" as const,
    stakeholders,
    youId: myStakeholder?.id ?? founderStakeholderId,
    founderId: v.founder_id ?? "",
    balanceKobo: Number(v.balance_kobo),
    fundingAccount: v.funding_account || v.nomba_virtual_account_number || "",
    nombaVirtualAccountBank: v.nomba_virtual_account_bank || undefined,
    transactions: [],
    linkInvitations: (linkInvitesRes.data ?? []).map((li) => ({
      id: li.id,
      token: li.token,
      placeholder: li.placeholder,
      invitedBy: li.invited_by,
      status: li.status as "pending" | "accepted" | "declined",
      createdAt: new Date(li.created_at).getTime(),
    })),
    emailInvites: (emailInvitesRes.data ?? []).map((ei) => ({
      id: ei.id,
      name: ei.name,
      email: ei.email,
      initials: ei.initials,
      invitedBy: ei.invited_by,
      createdAt: new Date(ei.created_at).getTime(),
      status: ei.status as "pending" | "accepted",
    })),
    pendingJoins: (pendingJoinsRes.data ?? []).map((pj) => ({
      id: pj.id,
      vaultId: pj.vault_id,
      name: pj.name,
      initials: pj.initials,
      viaToken: pj.via_token,
      requestedAt: new Date(pj.requested_at).getTime(),
    })),
    updatedAt: new Date(v.updated_at).getTime(),
  });
}

export async function GET(
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

  // Confirm user is a member
  const { data: membership } = await getServiceClient()
    .from("stakeholders")
    .select("id, is_founder")
    .eq("vault_id", vaultId)
    .eq("email", session.user.email)
    .maybeSingle();

  if (!membership) {
    return Response.json(
      { error: "Not a vault member" },
      { status: 403 }
    );
  }

  // Fetch vault
  const { data: vault } = await getServiceClient()
    .from("vaults")
    .select("*")
    .eq("id", vaultId)
    .maybeSingle();

  if (!vault) {
    return Response.json(
      { error: "Vault not found" },
      { status: 404 }
    );
  }

  // Fetch stakeholders
  const { data: stakeholders } = await getServiceClient()
    .from("stakeholders")
    .select("*")
    .eq("vault_id", vaultId);

  // Fetch transactions with approvals
  const { data: transactions } = await getServiceClient()
    .from("transactions")
    .select(`
      *,
      transaction_approvals (
        id,
        stakeholder_id,
        approved_at
      )
    `)
    .eq("vault_id", vaultId)
    .order("requested_at", { ascending: false });

  // Fetch link invitations
  const { data: linkInvitations } = await getServiceClient()
    .from("link_invitations")
    .select("*")
    .eq("vault_id", vaultId);

  // Fetch email invites
  const { data: emailInvites } = await getServiceClient()
    .from("email_invites")
    .select("*")
    .eq("vault_id", vaultId);

  // Fetch pending joins
  const { data: pendingJoins } = await getServiceClient()
    .from("pending_joins")
    .select("*")
    .eq("vault_id", vaultId);

  return Response.json({
    vault: {
      id: vault.id,
      name: vault.name,
      quorum: vault.quorum,
      status: vault.status,
      stakeholders: (stakeholders ?? []).map((sh) => ({
        id: sh.id,
        name: sh.name,
        initials: sh.initials,
        email: sh.email ?? undefined,
        phone: sh.phone ?? undefined,
        isFounder: sh.is_founder,
      })),
      transactions: transactions ?? [],
      linkInvitations: (linkInvitations ?? []).map((li) => ({
        id: li.id,
        token: li.token,
        placeholder: li.placeholder,
        invitedBy: li.invited_by,
        status: li.status,
        createdAt: new Date(li.created_at).getTime(),
      })),
      emailInvites: (emailInvites ?? []).map((ei) => ({
        id: ei.id,
        name: ei.name,
        email: ei.email,
        initials: ei.initials,
        invitedBy: ei.invited_by,
        createdAt: new Date(ei.created_at).getTime(),
        status: ei.status,
      })),
      pendingJoins: (pendingJoins ?? []).map((pj) => ({
        id: pj.id,
        vaultId: pj.vault_id,
        name: pj.name,
        initials: pj.initials,
        viaToken: pj.via_token,
        requestedAt: new Date(pj.requested_at).getTime(),
      })),
      youId: membership.id,
      founderId: vault.founder_id,
      balanceKobo: Number(vault.balance_kobo),
      fundingAccount: vault.funding_account || vault.nomba_virtual_account_number || "",
      nombaVirtualAccountBank: vault.nomba_virtual_account_bank || undefined,
      updatedAt: new Date(vault.updated_at).getTime(),
    }
  });
}
