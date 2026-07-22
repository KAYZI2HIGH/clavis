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

  // Re-fetch vault to check account status
  const { data: vaultRow } = await getServiceClient()
    .from("vaults")
    .select("revenue_account_number, name")
    .eq("id", vaultId)
    .single();

  // If VA wasn't created during the draft phase, retry now
  if (!vaultRow?.revenue_account_number) {
    // In V2, we might create Monnify accounts here, or maybe it's handled via a separate action.
  }

  // Fetch full vault data to return
  const [stakeholdersRes, linkInvitesRes, emailInvitesRes, pendingJoinsRes, vaultRes] =
    await Promise.all([
      getServiceClient().from("stakeholders").select("*").eq("vault_id", vaultId),
      getServiceClient().from("vault_invites").select("*").eq("vault_id", vaultId).is("email", null),
      getServiceClient().from("vault_invites").select("*").eq("vault_id", vaultId).not("email", "is", null),
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
    revenueAccountNumber: v.revenue_account_number,
    revenueAccountBank: v.revenue_account_bank,
    capitalAccountNumber: v.capital_account_number,
    capitalAccountBank: v.capital_account_bank,
    transactions: [],
    linkInvitations: (linkInvitesRes.data ?? []).map((li) => ({
      id: li.id,
      token: li.invite_code,
      placeholder: "",
      invitedBy: li.invited_by,
      status: li.status as "pending" | "accepted" | "declined",
      createdAt: new Date(li.created_at).getTime(),
    })),
    emailInvites: (emailInvitesRes.data ?? []).map((ei) => ({
      id: ei.id,
      name: ei.email,
      email: ei.email,
      initials: ei.email.substring(0, 2).toUpperCase(),
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

  const email = session.user.email;
  const phone = session.user.phone;

  if (!email && !phone) {
    return Response.json(
      { error: "Unauthorized: session is missing email and phone" },
      { status: 401 }
    );
  }

  // Confirm user is a member (either via email or phone matching)
  const query = getServiceClient()
    .from("stakeholders")
    .select("id, is_founder")
    .eq("vault_id", vaultId);

  const { data: membership } = await (
    email && phone
      ? query.or(`email.eq.${email},phone.eq.${phone}`)
      : email
      ? query.eq("email", email)
      : query.eq("phone", phone!)
  ).maybeSingle();

  if (!membership) {
    return Response.json(
      { error: "Not a vault member" },
      { status: 403 }
    );
  }

  // Fetch vault
  const { data: vault } = await getServiceClient()
    .from("vaults")
    .select("*, investment_terms:investment_type, investor_profit_share, investor_monthly_fixed, investor_return_cap, term_duration_months, settlement_day")
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

  // Fetch link invitations (vault_invites where email is null)
  const { data: linkInvitations } = await getServiceClient()
    .from("vault_invites")
    .select("*")
    .eq("vault_id", vaultId)
    .is("email", null);

  // Fetch email invites (vault_invites where email is not null)
  const { data: emailInvites } = await getServiceClient()
    .from("vault_invites")
    .select("*")
    .eq("vault_id", vaultId)
    .not("email", "is", null);

  // Fetch pending joins
  const { data: pendingJoins } = await getServiceClient()
    .from("pending_joins")
    .select("*")
    .eq("vault_id", vaultId);

  // Fetch active standing orders
  const { data: standingOrders } = await getServiceClient()
    .from("standing_orders")
    .select("*")
    .eq("vault_id", vaultId)
    .eq("status", "active");

  // Fetch last 3 settlements
  const { data: settlements } = await getServiceClient()
    .from("settlements")
    .select("*")
    .eq("vault_id", vaultId)
    .order("created_at", { ascending: false })
    .limit(3);

  // Fetch flagged inflow classifications
  const { data: inflowClassifications } = await getServiceClient()
    .from("inflow_classifications")
    .select("*")
    .eq("vault_id", vaultId)
    .eq("flagged_for_review", true);

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
      transactions: (transactions ?? []).map((t: {
        id: string;
        vault_id: string;
        recipient_name: string;
        recipient_account: string;
        recipient_bank_code: string | null;
        recipient_bank_name: string | null;
        amount_kobo: number;
        memo: string | null;
        status: string;
        requested_by: string | null;
        requested_at: string;
        required_quorum: number | null;
        sealed_at: string | null;
        settled_at: string | null;
        declined_by: string | null;
        decline_reason: string | null;
        narration: string | null;
        nomba_tx_ref: string | null;
        monnify_tx_ref: string | null;
        is_inflow: boolean | null;
        inflow_account_type: "revenue" | "capital" | null;
        transaction_approvals: { id: string; stakeholder_id: string; approved_at: string }[];
      }) => ({
        id: t.id,
        vault_id: t.vault_id,
        recipient_name: t.recipient_name,
        recipient_account: t.recipient_account,
        recipient_bank_code: t.recipient_bank_code,
        amount_kobo: Number(t.amount_kobo),
        memo: t.memo ?? "",
        status: t.status,
        requested_by: t.requested_by,
        requested_at: t.requested_at,
        required_quorum: t.required_quorum,
        settled_at: t.settled_at ?? undefined,
        declined_by: t.declined_by ?? undefined,
        decline_reason: t.decline_reason ?? undefined,
        narration: t.narration ?? undefined,
        nomba_tx_ref: t.nomba_tx_ref ?? undefined,
        monnify_tx_ref: t.monnify_tx_ref ?? undefined,
        is_inflow: t.is_inflow ?? false,
        inflow_account_type: t.inflow_account_type ?? undefined,
        approvals: (t.transaction_approvals ?? []).map((ta: { stakeholder_id: string }) => ta.stakeholder_id),
      })),
      linkInvitations: (linkInvitations ?? []).map((li) => ({
        id: li.id,
        token: li.invite_code,
        placeholder: "",
        invitedBy: li.invited_by,
        status: li.status,
        createdAt: new Date(li.created_at).getTime(),
      })),
      emailInvites: (emailInvites ?? []).map((ei) => ({
        id: ei.id,
        name: ei.email,
        email: ei.email,
        initials: ei.email.substring(0, 2).toUpperCase(),
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
      investorId: vault.investor_id,
      balance_kobo: Number(vault.balance_kobo),
      revenue_account_number: vault.revenue_account_number,
      revenue_account_bank: vault.revenue_account_bank,
      capital_account_number: vault.capital_account_number,
      capital_account_bank: vault.capital_account_bank,
      updatedAt: new Date(vault.updated_at).getTime(),
      
      // V2 Fields
      standingOrders: standingOrders ?? [],
      settlements: settlements ?? [],
      inflowClassifications: inflowClassifications ?? [],
      investmentTerms: {
        investment_type: vault.investment_type,
        investor_profit_share: vault.investor_profit_share,
        investor_monthly_fixed: vault.investor_monthly_fixed,
        investor_return_cap: vault.investor_return_cap,
        term_duration_months: vault.term_duration_months,
        settlement_day: vault.settlement_day,
      }
    }
  });
}
