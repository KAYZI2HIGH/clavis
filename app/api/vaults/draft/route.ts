import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { makeId, makeInitials } from "@/lib/vault-utils";

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

  if (!name || name.trim().length === 0) {
    return Response.json(
      { error: "Vault name is required" },
      { status: 400 }
    );
  }

  const founderId = makeId("sh");

  // Insert draft vault
  const { error: vaultError } = await getServiceClient()
    .from("vaults")
    .insert({
      id: vaultId,
      name: name.trim(),
      quorum: 2,
      balance_kobo: 0,
      founder_id: founderId,
      funding_account: "",
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (vaultError) {
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

  return Response.json({ 
    vaultId, 
    founderId 
  }, { status: 201 });
}
