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
    log({
      level: "error",
      event: "vault_draft_insert_failed",
      vaultId,
      error: vaultError.message,
    });
    return Response.json({ error: "Failed to create vault" }, { status: 500 });
  }

  // 2. Insert founder stakeholder
  const { error: shError } = await getServiceClient()
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

  if (shError) {
    log({
      level: "error",
      event: "vault_draft_founder_failed",
      vaultId,
      error: shError.message,
    });
    return Response.json(
      { error: "Failed to register founder" },
      { status: 500 },
    );
  }

  // 3. Link founder_id back to vault (circular FK now resolved)
  await getServiceClient()
    .from("vaults")
    .update({ founder_id: founderStakeholderId })
    .eq("id", vaultId);

  // 4. Create link_invitations record if method is link
  if (method === "link") {
    await getServiceClient()
      .from("link_invitations")
      .insert({
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

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const email = session.user.email;
  const phone = session.user.phone;

  const query = getServiceClient()
    .from("stakeholders")
    .select(`
      id,
      is_founder,
      vault_id,
      vaults!stakeholders_vault_id_fkey (
        id,
        name,
        quorum,
        balance_kobo,
        funding_account,
        nomba_virtual_account_number,
        nomba_virtual_account_bank,
        founder_id,
        status,
        created_at,
        updated_at,
        stakeholders!stakeholders_vault_id_fkey (
          id,
          name,
          email,
          phone,
          is_founder
        )
      )
    `);

  if (!email && !phone) {
    return Response.json({ vaults: [] });
  }

  const { data: memberships, error } = await (
    email && phone
      ? query.or(`email.eq.${email},phone.eq.${phone}`)
      : email
      ? query.eq("email", email)
      : query.eq("phone", phone!)
  );

  if (error) {
    console.error("[api/vaults GET] Error fetching vaults:", error);
    return Response.json(
      { error: "Failed to fetch vaults", details: error.message },
      { status: 500 }
    );
  }

  const vaults = memberships
    ?.map((m: any) => {
      const v = m.vaults || m.vaults_stakeholders_vault_id_fkey || m["vaults!stakeholders_vault_id_fkey"];
      if (!v) return null;
      return {
        id: v.id,
        name: v.name,
        quorum: v.quorum,
        balanceKobo: Number(v.balance_kobo),
        fundingAccount: v.funding_account,
        nombaVirtualAccountNumber: v.nomba_virtual_account_number,
        nombaVirtualAccountBank: v.nomba_virtual_account_bank,
        founderId: v.founder_id,
        status: v.status,
        createdAt: new Date(v.created_at).getTime(),
        updatedAt: new Date(v.updated_at).getTime(),
        stakeholders: ((v.stakeholders || v.stakeholders_stakeholders_vault_id_fkey || v["stakeholders!stakeholders_vault_id_fkey"]) ?? []).map((sh: any) => ({
          id: sh.id,
          name: sh.name,
          email: sh.email,
          phone: sh.phone,
          isFounder: sh.is_founder,
        })),
        youId: m.id,
      };
    })
    .filter(Boolean) ?? [];

  return Response.json({ vaults });
}
