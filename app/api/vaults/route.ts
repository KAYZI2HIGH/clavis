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

type RequestStakeholder = {
  name: string;
  email?: string;
  initials: string;
  isFounder?: boolean;
};

type RequestBody = {
  name?: string;
  quorum?: number;
  method?: "link" | "email";
  stakeholders?: RequestStakeholder[];
  linkToken?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const quorum = Number(body.quorum);
  const method = body.method;
  const stakeholders = body.stakeholders;
  const linkToken = body.linkToken?.trim();

  if (
    !name ||
    isNaN(quorum) ||
    quorum < 1 ||
    !method ||
    !stakeholders ||
    stakeholders.length === 0
  ) {
    return Response.json(
      { error: "Invalid vault creation parameters" },
      { status: 400 },
    );
  }

  const vaultId = makeId("v");
  const founderStakeholderId = makeId("sh");
  const founderName = session.user.name ?? "Founder";
  const founderInitials = makeInitials(founderName);

  // 1. Insert vault into Supabase vaults table (founder_id is initially null to bypass circular FK check)
  const { error: vaultError } = await getServiceClient().from("vaults").insert({
    id: vaultId,
    name,
    quorum,
    balance_kobo: 0,
    founder_id: null,
    funding_account: "", // placeholder, filled after Nomba VA
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (vaultError) {
    log({
      level: "error",
      event: "vault_creation_insert_failed",
      vaultId,
      error: vaultError.message,
    });
    return Response.json(
      { error: "Failed to create vault in database" },
      { status: 500 },
    );
  }

  // 2. Insert founder into stakeholders table
  const { error: stakeholderError } = await getServiceClient()
    .from("stakeholders")
    .insert({
      id: founderStakeholderId,
      vault_id: vaultId,
      name: founderName,
      initials: founderInitials,
      email: session.user.email ?? null,
      phone: session.user.phone ?? null,
      is_founder: true,
      created_at: new Date().toISOString(),
    });

  if (stakeholderError) {
    log({
      level: "error",
      event: "vault_creation_founder_stakeholder_failed",
      vaultId,
      error: stakeholderError.message,
    });
    return Response.json(
      { error: "Failed to register founder stakeholder" },
      { status: 500 },
    );
  }

  // 2b. Link founder's stakeholder ID back to vaults.founder_id
  const { error: updateFounderError } = await getServiceClient()
    .from("vaults")
    .update({
      founder_id: founderStakeholderId,
    })
    .eq("id", vaultId);

  if (updateFounderError) {
    log({
      level: "error",
      event: "vault_creation_founder_link_failed",
      vaultId,
      error: updateFounderError.message,
    });
    return Response.json(
      { error: "Failed to link founder to vault" },
      { status: 500 },
    );
  }

  const emailInvitesList = [];
  const linkInvitationsList = [];

  // 3. If method is "email" - insert non-founders only into email_invites (no stakeholders table insert yet)
  if (method === "email") {
    for (const sh of stakeholders) {
      if (sh.isFounder) continue;

      const eiId = makeId("ei");
      const { error: inviteError } = await getServiceClient()
        .from("email_invites")
        .insert({
          id: eiId,
          vault_id: vaultId,
          name: sh.name,
          email: sh.email ?? "",
          initials: sh.initials,
          invited_by: founderStakeholderId,
          status: "pending",
          created_at: new Date().toISOString(),
        });

      if (inviteError) {
        log({
          level: "error",
          event: "vault_creation_email_invite_failed",
          vaultId,
          error: inviteError.message,
        });
        return Response.json(
          { error: `Failed to create invitation for ${sh.name}` },
          { status: 500 },
        );
      }

      emailInvitesList.push({
        id: eiId,
        name: sh.name,
        email: sh.email ?? "",
        initials: sh.initials,
        invitedBy: founderStakeholderId,
        createdAt: Date.now(),
        status: "pending" as const,
      });
    }
  }

  // 4. If method is "link" - insert into link_invitations table
  if (method === "link" && linkToken) {
    const liId = makeId("li");
    let finalLinkToken = linkToken;
    let linkError: { code?: string; message: string } | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await getServiceClient().from("link_invitations").insert({
        id: liId,
        vault_id: vaultId,
        token: finalLinkToken,
        placeholder: "Pending",
        invited_by: founderStakeholderId,
        status: "pending",
        created_at: new Date().toISOString(),
      });

      linkError = result.error ?? null;
      if (!linkError) break;

      if (linkError.code === "23505") {
        finalLinkToken = makeLinkToken();
        continue;
      }

      break;
    }

    if (linkError) {
      log({
        level: "error",
        event: "vault_creation_link_invitation_failed",
        vaultId,
        token: finalLinkToken,
        error: linkError.message,
      });
      return Response.json(
        { error: "Failed to create link invitation" },
        { status: 500 },
      );
    }

    linkInvitationsList.push({
      id: liId,
      token: finalLinkToken,
      placeholder: "Pending",
      invitedBy: founderStakeholderId,
      status: "pending" as const,
      createdAt: Date.now(),
    });
  }

  // 5. Call createVirtualAccount() from lib/nomba/accounts.ts
  let virtualAccountNumber = "";
  try {
    const va = await createVirtualAccount({
      vaultId,
      vaultName: name,
    });
    virtualAccountNumber = va.accountNumber;

    // 6. Update vault row with Nomba virtual account details in funding_account
    const { error: updateError } = await getServiceClient()
      .from("vaults")
      .update({
        funding_account: virtualAccountNumber,
      })
      .eq("id", vaultId);

    if (updateError) {
      log({
        level: "error",
        event: "vault_creation_funding_account_update_failed",
        vaultId,
        error: updateError.message,
      });
      return Response.json(
        { error: "Failed to store vault funding account" },
        { status: 500 },
      );
    }
  } catch (err) {
    log({
      level: "error",
      event: "vault_creation_nomba_account_failed",
      vaultId,
      error: err instanceof Error ? err.message : String(err),
    });

    return Response.json(
      { error: "Failed to create Nomba virtual account" },
      { status: 502 },
    );
  }

  // 7. Return the full vault object matching the Vault type in lib/types.ts
  return Response.json({
    id: vaultId,
    name,
    quorum,
    balanceKobo: 0,
    fundingAccount: virtualAccountNumber,
    founderId: session.user.id,
    stakeholders: [
      {
        id: founderStakeholderId,
        name: founderName,
        initials: founderInitials,
        email: session.user.email ?? undefined,
        phone: session.user.phone ?? undefined,
        isFounder: true,
      },
    ],
    transactions: [],
    linkInvitations: linkInvitationsList,
    emailInvites: emailInvitesList,
    pendingJoins: [],
    youId: founderStakeholderId,
  });
}

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
    log({
      level: "error",
      event: "vaults_fetch_stakeholders_failed",
      error: shError.message,
    });
    return Response.json(
      { error: "Failed to fetch user vaults metadata" },
      { status: 500 },
    );
  }

  const vaultIds = Array.from(
    new Set(shRows?.map((row) => row.vault_id) ?? []),
  );
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
    getServiceClient().from("vaults").select("*").in("id", vaultIds),
    getServiceClient()
      .from("stakeholders")
      .select("*")
      .in("vault_id", vaultIds),
    getServiceClient()
      .from("transactions")
      .select("*")
      .in("vault_id", vaultIds)
      .order("requested_at", { ascending: false }),
    getServiceClient()
      .from("link_invitations")
      .select("*")
      .in("vault_id", vaultIds),
    getServiceClient()
      .from("email_invites")
      .select("*")
      .in("vault_id", vaultIds),
    getServiceClient()
      .from("pending_joins")
      .select("*")
      .in("vault_id", vaultIds),
  ]);

  if (vaultsResult.error) {
    log({
      level: "error",
      event: "vaults_fetch_vaults_failed",
      error: vaultsResult.error.message,
    });
    return Response.json(
      { error: "Failed to fetch user vaults" },
      { status: 500 },
    );
  }

  const vaults = vaultsResult.data ?? [];
  const allStakeholders = stakeholdersResult.data ?? [];
  const allTransactions = transactionsResult.data ?? [];
  const allLinkInvites = linkInvitesResult.data ?? [];
  const allEmailInvites = emailInvitesResult.data ?? [];
  const allPendingJoins = pendingJoinsResult.data ?? [];

  const transactionIds = allTransactions.map((tx) => tx.id);
  let allApprovals: any[] = [];
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
          status: tx.status as any,
          requiredQuorum: tx.required_quorum,
          sealedAt: tx.sealed_at ? new Date(tx.sealed_at).getTime() : undefined,
          settledAt:
            tx.settled_at ? new Date(tx.settled_at).getTime() : undefined,
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
        status: li.status as any,
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
        status: ei.status as any,
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
      stakeholders: stakeholdersList,
      youId,
      founderId: v.founder_id ?? "",
      balanceKobo: Number(v.balance_kobo),
      fundingAccount: v.funding_account,
      transactions: transactionsList,
      linkInvitations,
      pendingJoins,
      emailInvites,
    };
  });

  return Response.json({ vaults: formattedVaults });
}
