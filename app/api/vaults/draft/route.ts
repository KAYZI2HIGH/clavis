import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { makeId, makeInitials } from "@/lib/vault-utils";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; vaultId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();

  if (!name) {
    return Response.json({ error: "Vault name is required" }, { status: 400 });
  }

  const vaultId = body.vaultId || makeId("v");
  const investorStakeholderId = makeId("sh");

  // 1. Insert draft vault
  const { error: vaultError } = await getServiceClient().from("vaults").insert({
    id: vaultId,
    name,
    status: "draft",
    investor_id: investorStakeholderId,
    balance_kobo: 0,
    quorum: 1, // Set quorum to 1 as default, modified later implicitly by number of operators
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
    return Response.json({ error: "Failed to create vault draft" }, { status: 500 });
  }

  // 2. Insert investor as stakeholder
  const investorName = session.user.name ?? "Investor";
  const investorInitials = makeInitials(investorName);
  
  const { error: shError } = await getServiceClient()
    .from("stakeholders")
    .insert({
      id: investorStakeholderId,
      vault_id: vaultId,
      name: investorName,
      initials: investorInitials,
      email: session.user.email ?? null,
      phone: session.user.phone ?? null,
      is_investor: true,
      role: "investor",
      created_at: new Date().toISOString(),
    });

  if (shError) {
    log({
      level: "error",
      event: "vault_draft_investor_failed",
      vaultId,
      error: shError.message,
    });
    return Response.json(
      { error: "Failed to register investor" },
      { status: 500 },
    );
  }

  // 3. Create an active link invitation matching the vaultId so operators can join
  const { error: linkError } = await getServiceClient()
    .from("link_invitations")
    .insert({
      id: makeId("link"),
      vault_id: vaultId,
      token: vaultId, // token is the vaultId for simplicity in v2
      invited_by: investorStakeholderId,
      status: "pending",
      created_at: new Date().toISOString(),
    });

  if (linkError) {
    log({
      level: "error",
      event: "vault_draft_link_failed",
      vaultId,
      error: linkError.message,
    });
    // Non-fatal, but could cause issues joining
  }

  return Response.json({
    vaultId,
    investorStakeholderId,
  });
}
