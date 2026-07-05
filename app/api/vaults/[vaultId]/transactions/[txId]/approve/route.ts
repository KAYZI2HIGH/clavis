import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ vaultId: string; txId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultId, txId } = await params;

  // Confirm approver is a vault member (match by email or phone)
  const email = session.user.email;
  const phone = (session.user as any).phone;

  const orParts = [];
  if (email) orParts.push(`email.eq.${email}`);
  if (phone) orParts.push(`phone.eq.${phone}`);

  if (orParts.length === 0) {
    return Response.json({ error: "Not a vault member" }, { status: 403 });
  }

  const { data: approver } = await getServiceClient()
    .from("stakeholders")
    .select("id")
    .eq("vault_id", vaultId)
    .or(orParts.join(","))
    .maybeSingle();

  if (!approver) {
    return Response.json(
      { error: "Not a vault member" },
      { status: 403 }
    );
  }

  // Fetch transaction
  const { data: tx } = await getServiceClient()
    .from("transactions")
    .select("*")
    .eq("id", txId)
    .eq("vault_id", vaultId)
    .maybeSingle();

  if (!tx) {
    return Response.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  }

  if (tx.status !== "pending") {
    return Response.json(
      { error: "Transaction is no longer pending" },
      { status: 400 }
    );
  }

  // Check approver hasn't already approved
  const { data: existing } = await getServiceClient()
    .from("transaction_approvals")
    .select("id")
    .eq("transaction_id", txId)
    .eq("stakeholder_id", approver.id)
    .maybeSingle();

  if (existing) {
    return Response.json(
      { error: "Already approved" },
      { status: 400 }
    );
  }

  // Record approval
  await getServiceClient()
    .from("transaction_approvals")
    .insert({
      transaction_id: txId,
      stakeholder_id: approver.id,
      approved_at: new Date().toISOString(),
    });

  // Get all approvals so far
  const { data: approvals } = await getServiceClient()
    .from("transaction_approvals")
    .select("id")
    .eq("transaction_id", txId);

  const approvalsCount = approvals?.length ?? 0;

  // Fetch vault for quorum
  const { data: vault } = await getServiceClient()
    .from("vaults")
    .select("quorum, name")
    .eq("id", vaultId)
    .maybeSingle();

  if (!vault) {
    return Response.json(
      { error: "Vault not found" },
      { status: 404 }
    );
  }

  const quorumReached = approvalsCount >= vault.quorum;

  // Check if quorum is reached
  if (quorumReached) {
    // Update transaction status to executing
    await getServiceClient()
      .from("transactions")
      .update({ status: "executing" })
      .eq("id", txId);

    // Trigger Nomba transfer
    log({
      level: "info",
      event: "quorum_reached",
      merchantTxRef: tx.nomba_tx_ref,
      vaultId,
      txId,
      approvalsCount,
      quorum: vault.quorum,
    });

    // Call transfers API internally
    const transferRes = await fetch(
      `${process.env.NEXTAUTH_URL}/api/transfers`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: txId,
          vaultId,
        }),
      }
    );

    if (!transferRes.ok) {
      log({
        level: "error",
        event: "transfer_trigger_failed",
        merchantTxRef: tx.nomba_tx_ref,
        vaultId,
        txId,
      });
    }
  }

  return Response.json({ 
    approved: true, 
    approvalsCount,
    quorumReached,
  });
}
