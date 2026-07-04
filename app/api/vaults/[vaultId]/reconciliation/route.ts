import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultId } = await params;

  const { data } = await getServiceClient()
    .from("reconciliation_logs")
    .select("*")
    .eq("vault_id", vaultId)
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Response.json(data ?? null);
}
