import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ vaultId: string; txId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultId, txId } = await params;
  const { reason } = await request.json();

  if (!reason || reason.trim().length < 5) {
    return Response.json(
      { error: "Reason must be at least 5 characters" },
      { status: 400 }
    );
  }

  // Confirm rejector is a vault member
  const { data: member } = await getServiceClient()
    .from("stakeholders")
    .select("id")
    .eq("vault_id", vaultId)
    .eq("email", session.user.email)
    .maybeSingle();

  if (!member) {
    return Response.json(
      { error: "Not a vault member" },
      { status: 403 }
    );
  }

  // Confirm transaction is still pending
  const { data: tx } = await getServiceClient()
    .from("transactions")
    .select("status")
    .eq("id", txId)
    .eq("vault_id", vaultId)
    .maybeSingle();

  if (!tx || tx.status !== "pending") {
    return Response.json(
      { error: "Transaction is no longer pending" },
      { status: 400 }
    );
  }

  // Update transaction to declined
  await getServiceClient()
    .from("transactions")
    .update({
      status: "declined",
      declined_by: member.id,
      decline_reason: reason.trim(),
    })
    .eq("id", txId);

  return Response.json({ rejected: true });
}
