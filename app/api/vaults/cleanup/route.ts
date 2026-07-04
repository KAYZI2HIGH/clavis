import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * POST /api/vaults/cleanup
 * Deletes abandoned draft vaults owned by the current user
 * that are older than 24 hours. Called on login/mount.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  const phone = session.user.phone;

  if (!email && !phone) {
    return Response.json({ deleted: 0 });
  }

  // Find draft vaults older than 24h where the user is the founder
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let orCondition = "";
  if (email) orCondition += `email.eq.${email}`;
  if (phone) {
    if (orCondition) orCondition += ",";
    orCondition += `phone.eq.${phone}`;
  }

  // Find all stakeholder rows where this user is a founder
  const { data: founderRows } = await getServiceClient()
    .from("stakeholders")
    .select("vault_id")
    .eq("is_founder", true)
    .or(orCondition);

  if (!founderRows || founderRows.length === 0) {
    return Response.json({ deleted: 0 });
  }

  const founderVaultIds = founderRows.map((r) => r.vault_id);

  // Delete draft vaults older than 24h from that set
  const { data: deleted } = await getServiceClient()
    .from("vaults")
    .delete()
    .in("id", founderVaultIds)
    .eq("status", "draft")
    .lt("created_at", cutoff)
    .select("id");

  return Response.json({ deleted: deleted?.length ?? 0 });
}
