import crypto from "crypto";
import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { makeId, makeInitials } from "@/lib/vault-utils";
import { createVirtualAccount } from "@/lib/nomba/accounts";
import { log } from "@/lib/logger";
import { getBankName } from "@/lib/nigerian-banks";

export const runtime = "nodejs";

function makeLinkToken(): string {
  return crypto.randomUUID().replace(/-/g, "").toUpperCase();
}

/**
 * POST /api/vaults
 * Eagerly creates a draft vault at the name step.
 * Body: { name: string, method: "link" | "email" }
 * Returns: { id, linkToken, founderStakeholderId }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; method?: "link" | "email" };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const method = body.method ?? "link";

  if (!name) {
    return Response.json({ error: "Vault name is required" }, { status: 400 });
  }

  const vaultId = makeId("v");
  const founderStakeholderId = makeId("sh");
  const founderName = session.user.name ?? "Founder";
  const founderInitials = makeInitials(founderName);
  const linkToken = makeLinkToken();

  // 1. Insert draft vault (founder_id null initially to avoid circular FK)
  const { error: vaultError } = await getServiceClient().from("vaults").insert({
    id: vaultId,
    name,
    quorum: null,
    balance_kobo: 0,
    founder_id: null,
    funding_account: null,
    status: "draft",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (vaultError) {
    log({ level: "error", event: "vault_draft_insert_failed", vaultId, error: vaultError.message });
    return Response.json({ error: "Failed to create vault" }, { status: 500 });
  }

  // 2. Insert founder stakeholder
  const { error: shError } = await getServiceClient().from("stakeholders").insert({
    id: founderStakeholderId,
    vault_id: vaultId,
    name: founderName,
    initials: founderInitials,
    email: session.user.email ?? null,
    phone: session.user.phone ?? null,
    is_founder: true,
    created_at: new Date().toISOString(),
  });

  if (shError) {
    log({ level: "error", event: "vault_draft_founder_failed", vaultId, error: shError.message });
    return Response.json({ error: "Failed to register founder" }, { status: 500 });
  }

  // 3. Link founder_id back to vault (circular FK now resolved)
  await getServiceClient()
    .from("vaults")
    .update({ founder_id: founderStakeholderId })
    .eq("id", vaultId);

  // 4. Create link_invitations record if method is link
  if (method === "link") {
    await getServiceClient().from("link_invitations").insert({
      id: makeId("li"),
      vault_id: vaultId,
      token: linkToken,
      placeholder: "Pending",
      invited_by: founderStakeholderId,
      status: "pending",
      created_at: new Date().toISOString(),
    });
  }

  // 5. Kick off Nomba virtual account creation in background (don't block response)
  createVirtualAccount({ vaultId, vaultName: name }).catch((err) => {
    log({
      level: "error",
      event: "vault_draft_nomba_failed",
      vaultId,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return Response.json({
    id: vaultId,
    linkToken,
    founderStakeholderId,
    method,
  });
}

/**
 * GET /api/vaults
 * Returns all ACTIVE vaults the current user is a stakeholder of.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  const phone = session.user.phone;

  if (!email && !phone) {
    return Response.json({ vaults: [] });
  }

  let orCondition = "";
  if (email) orCondition += `email.eq.${email}`;
  if (phone) {
    if (orCondition) orCondition += ",";
    orCondition += `phone.eq.${phone}`;
  }

  const { data: shRows, error: shError } = await getServiceClient()
    .from("stakeholders")
    .select("vault_id")
    .or(orCondition);

  if (shError) {
    log({ level: "error", event: "vaults_fetch_stakeholders_failed", error: shError.message });
    return Response.json({ error: "Failed to fetch user vaults metadata" }, { status: 500 });
  }

  const vaultIds = Array.from(new Set(shRows?.map((row) => row.vault_id) ?? []));
  if (vaultIds.length === 0) {
    return Response.json({ vaults: [] });
  }

  const [
    vaultsResult,
    stakeholdersResult,
    transactionsResult,
    linkInvitesResult,
    emailInvitesResult,
    pendingJoinsResult,
  ] = await Promise.all([
    getServiceClient()
      .from("vaults")
      .select("*")
      .in("id", vaultIds), // Return both active and draft vaults
    getServiceClient().from("stakeholders").select("*").in("vault_id", vaultIds),
    getServiceClient()
      .from("transactions")
      .select("*")
      .in("vault_id", vaultIds)
      .order("requested_at", { ascending: false }),
    getServiceClient().from("link_invitations").select("*").in("vault_id", vaultIds),
    getServiceClient().from("email_invites").select("*").in("vault_id", vaultIds),
    getServiceClient().from("pending_joins").select("*").in("vault_id", vaultIds),
  ]);

  if (vaultsResult.error) {
    log({ level: "error", event: "vaults_fetch_failed", error: vaultsResult.error.message });
    return Response.json({ error: "Failed to fetch user vaults" }, { status: 500 });
  }

  const vaults = vaultsResult.data ?? [];
  const allStakeholders = stakeholdersResult.data ?? [];
  const allTransactions = transactionsResult.data ?? [];
  const allLinkInvites = linkInvitesResult.data ?? [];
  const allEmailInvites = emailInvitesResult.data ?? [];
  const allPendingJoins = pendingJoinsResult.data ?? [];

  const transactionIds = allTransactions.map((tx) => tx.id);
  let allApprovals: { transaction_id: string; stakeholder_id: string }[] = [];
  if (transactionIds.length > 0) {
    const { data } = await getServiceClient()
      .from("transaction_approvals")
      .select("transaction_id, stakeholder_id")
      .in("transaction_id", transactionIds);
    allApprovals = data ?? [];
  }

  const formattedVaults = vaults.map((v) => {
    const stakeholdersList = allStakeholders
      .filter((sh) => sh.vault_id === v.id)
      .map((sh) => ({
        id: sh.id,
        name: sh.name,
        initials: sh.initials,
        email: sh.email ?? undefined,
        phone: sh.phone ?? undefined,
        isFounder: sh.is_founder,
      }));

    const myStakeholder = stakeholdersList.find(
      (sh) => (email && sh.email === email) || (phone && sh.phone === phone),
    );
    const youId = myStakeholder?.id ?? v.founder_id ?? "";

    const transactionsList = allTransactions
      .filter((tx) => tx.vault_id === v.id)
      .map((tx) => {
        const approvals = allApprovals
          .filter((ap) => ap.transaction_id === tx.id)
          .map((ap) => ap.stakeholder_id);
        return {
          id: tx.id,
          vaultId: tx.vault_id,
          recipientName: tx.recipient_name,
          recipientAccount: tx.recipient_account,
          recipientBankCode: tx.recipient_bank_code ?? "",
          recipientBankName: getBankName(tx.recipient_bank_code ?? ""),
          amountKobo: Number(tx.amount_kobo),
          memo: tx.memo,
          requestedBy: tx.requested_by ?? "",
          requestedAt: new Date(tx.requested_at).getTime(),
          approvals,
          status: tx.status as "pending" | "sealed" | "settled" | "declined",
          requiredQuorum: tx.required_quorum,
          sealedAt: tx.sealed_at ? new Date(tx.sealed_at).getTime() : undefined,
          settledAt: tx.settled_at ? new Date(tx.settled_at).getTime() : undefined,
          declinedBy: tx.declined_by ?? undefined,
          declineReason: tx.decline_reason ?? undefined,
        };
      });

    const linkInvitations = allLinkInvites
      .filter((li) => li.vault_id === v.id)
      .map((li) => ({
        id: li.id,
        token: li.token,
        placeholder: li.placeholder,
        invitedBy: li.invited_by,
        status: li.status as "pending" | "accepted" | "declined",
        createdAt: new Date(li.created_at).getTime(),
      }));

    const emailInvites = allEmailInvites
      .filter((ei) => ei.vault_id === v.id)
      .map((ei) => ({
        id: ei.id,
        name: ei.name,
        email: ei.email,
        initials: ei.initials,
        invitedBy: ei.invited_by,
        createdAt: new Date(ei.created_at).getTime(),
        status: ei.status as "pending" | "accepted",
      }));

    const pendingJoins = allPendingJoins
      .filter((pj) => pj.vault_id === v.id)
      .map((pj) => ({
        id: pj.id,
        vaultId: pj.vault_id,
        name: pj.name,
        initials: pj.initials,
        viaToken: pj.via_token,
        requestedAt: new Date(pj.requested_at).getTime(),
      }));

    return {
      id: v.id,
      name: v.name,
      quorum: v.quorum,
      status: v.status as "draft" | "active",
      stakeholders: stakeholdersList,
      youId,
      founderId: v.founder_id ?? "",
      balanceKobo: Number(v.balance_kobo),
      fundingAccount: v.funding_account || v.nomba_virtual_account_number || "",
      nombaVirtualAccountBank: v.nomba_virtual_account_bank || undefined,
      transactions: transactionsList,
      linkInvitations,
      pendingJoins,
      emailInvites,
    };
  });

  return Response.json({ vaults: formattedVaults });
}
