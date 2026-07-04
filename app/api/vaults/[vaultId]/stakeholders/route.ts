import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * GET /api/vaults/[vaultId]/stakeholders
 * Returns live stakeholders + pending joins for a vault.
 * Used by React Query polling on the invite step.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ vaultId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultId } = await params;

  const [stakeholdersRes, pendingJoinsRes] = await Promise.all([
    getServiceClient().from("stakeholders").select("*").eq("vault_id", vaultId),
    getServiceClient().from("pending_joins").select("*").eq("vault_id", vaultId),
  ]);

  const stakeholders = (stakeholdersRes.data ?? []).map((sh) => ({
    id: sh.id,
    name: sh.name,
    initials: sh.initials,
    email: sh.email ?? undefined,
    phone: sh.phone ?? undefined,
    isFounder: sh.is_founder,
  }));

  const pendingJoins = (pendingJoinsRes.data ?? []).map((pj) => ({
    id: pj.id,
    vaultId: pj.vault_id,
    name: pj.name,
    initials: pj.initials,
    viaToken: pj.via_token,
    requestedAt: new Date(pj.requested_at).getTime(),
  }));

  return Response.json({ stakeholders, pendingJoins });
}
