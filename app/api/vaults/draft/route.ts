import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { makeId, makeInitials } from "@/lib/vault-utils";
import { log } from "@/lib/logger";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = body.name;
  const vaultId = body.vaultId ?? makeId("v");
  const method = body.method ?? "link";

  if (!name || name.trim().length === 0) {
    return Response.json(
      { error: "Vault name is required" },
      { status: 400 }
    );
  }

  const founderId = makeId("sh");
  const token = method === "link" ? (body.token ?? makeId("tk")) : null;

  // Insert draft vault with founder_id null first to avoid foreign key constraints
  const { error: vaultError } = await getServiceClient()
    .from("vaults")
    .insert({
      id: vaultId,
      name: name.trim(),
      quorum: 2,
      balance_kobo: 0,
      founder_id: null,
      funding_account: "",
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (vaultError) {
    log({
      level: "error",
      event: "draft_vault_creation_failed",
      vaultId,
      error: vaultError.message,
    });
    return Response.json(
      { error: "Failed to create vault", details: vaultError.message },
      { status: 500 }
    );
  }

  // Insert founder as first stakeholder
  const { error: stakeholderError } = await getServiceClient()
    .from("stakeholders")
    .insert({
      id: founderId,
      vault_id: vaultId,
      name: session.user.name ?? "Founder",
      initials: makeInitials(session.user.name ?? "Founder"),
      email: session.user.email,
      phone: session.user.phone ?? null,
      is_founder: true,
      created_at: new Date().toISOString(),
    });

  if (stakeholderError) {
    log({
      level: "error",
      event: "draft_stakeholder_creation_failed",
      vaultId,
      error: stakeholderError.message,
    });
    // Rollback vault
    await getServiceClient()
      .from("vaults")
      .delete()
      .eq("id", vaultId);

    return Response.json(
      { error: "Failed to create founder", details: stakeholderError.message },
      { status: 500 }
    );
  }

  // Now update the vault's founder_id with the inserted stakeholder ID
  const { error: updateError } = await getServiceClient()
    .from("vaults")
    .update({ founder_id: founderId })
    .eq("id", vaultId);

  if (updateError) {
    log({
      level: "error",
      event: "draft_vault_founder_update_failed",
      vaultId,
      error: updateError.message,
    });
    // Rollback both
    await getServiceClient()
      .from("stakeholders")
      .delete()
      .eq("id", founderId);
    await getServiceClient()
      .from("vaults")
      .delete()
      .eq("id", vaultId);

    return Response.json(
      { error: "Failed to link founder to vault", details: updateError.message },
      { status: 500 }
    );
  }



  // If link method is selected, insert the link invitation record
  if (token) {
    const { error: tokenError } = await getServiceClient()
      .from("link_invitations")
      .insert({
        id: makeId("li"),
        vault_id: vaultId,
        token: token,
        placeholder: "",
        invited_by: founderId,
        status: "pending",
        created_at: new Date().toISOString(),
      });

    if (tokenError) {
      log({
        level: "error",
        event: "draft_link_token_insert_failed",
        vaultId,
        error: tokenError.message,
      });
      // Rollback previous steps
      await getServiceClient().from("stakeholders").delete().eq("id", founderId);
      await getServiceClient().from("vaults").delete().eq("id", vaultId);
      return Response.json(
        { error: "Failed to create invitation link", details: tokenError.message },
        { status: 500 }
      );
    }
  }

  return Response.json({ 
    vaultId, 
    founderId,
    token
  }, { status: 201 });
}
