import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { makeId } from "@/lib/vault-utils";
import { after } from "next/server";
import { initiateTransfer } from "@/lib/monnify/transfers";
import { log } from "@/lib/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultId } = await params;
  const {
    recipientName,
    recipientAccount,
    recipientBankCode,
    amountKobo,
    memo,
  } = await request.json();

  // Validate required fields
  if (!recipientName || !recipientAccount || 
      !recipientBankCode || !amountKobo) {
    return Response.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Confirm requester is a vault member (match by email or phone)
  const email = session.user.email;
  const phone = (session.user as any).phone;

  const orParts = [];
  if (email) orParts.push(`email.eq.${email}`);
  if (phone) orParts.push(`phone.eq.${phone}`);

  if (orParts.length === 0) {
    return Response.json(
      { error: "Not a vault member" },
      { status: 403 }
    );
  }

  const { data: member } = await getServiceClient()
    .from("stakeholders")
    .select("id")
    .eq("vault_id", vaultId)
    .or(orParts.join(","))
    .maybeSingle();

  if (!member) {
    return Response.json(
      { error: "Not a vault member" },
      { status: 403 }
    );
  }

  // Confirm vault has sufficient balance
  const { data: vault } = await getServiceClient()
    .from("vaults")
    .select("balance_kobo, quorum")
    .eq("id", vaultId)
    .maybeSingle();

  if (!vault) {
    return Response.json(
      { error: "Vault not found" },
      { status: 404 }
    );
  }

  if (amountKobo > vault.balance_kobo) {
    return Response.json(
      { error: "Insufficient vault balance" },
      { status: 400 }
    );
  }

  // Fetch standing orders
  const { data: standingOrders } = await getServiceClient()
    .from("standing_orders")
    .select("*")
    .eq("vault_id", vaultId)
    .eq("status", "active");

  const { matchStandingOrder } = await import("@/lib/standing-orders");
  const matchedOrder = standingOrders ? matchStandingOrder(standingOrders, {
    amount_kobo: amountKobo,
    recipient_account: recipientAccount,
  }) : null;

  let initialStatus = "pending";
  let finalQuorum = vault.quorum;
  let autoApproveUserId: string | null = null;

  if (matchedOrder) {
    if (matchedOrder.action === "auto_execute") {
      // The investor rule automatically approves this, granting 1 signature.
      autoApproveUserId = matchedOrder.proposed_by;
    } else if (matchedOrder.action === "always_require_investor") {
      // Investor must be one of the signers, but quorum count doesn't necessarily change 
      // (unless we want to enforce it strictly, but for now we keep the total count the same)
      finalQuorum = vault.quorum;
    }
  }

  // Insert transaction
  const txPayload = {
    id: makeId("tx"),
    vault_id: vaultId,
    requested_by: member.id,
    recipient_name: recipientName,
    recipient_account: recipientAccount,
    recipient_bank_code: recipientBankCode,
    amount_kobo: amountKobo,
    memo: memo || "",
    narration: memo || recipientName,
    status: initialStatus,
    required_quorum: finalQuorum,
    standing_order_id: matchedOrder?.id ?? null,
    requested_at: new Date().toISOString(),
    monnify_tx_ref: makeId("ref"),
  };

  const { data: transaction, error } = await getServiceClient()
    .from("transactions")
    .insert(txPayload)
    .select()
    .single();

  if (error) {
    console.error("Transaction insert error:", error);
    return Response.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }

  if (autoApproveUserId) {
    await getServiceClient().from("transaction_approvals").insert({
      id: makeId("apv"),
      transaction_id: transaction.id,
      stakeholder_id: autoApproveUserId,
    });

    if (finalQuorum <= 1) {
      await getServiceClient().from("transactions").update({
        status: "approved",
        sealed_at: new Date().toISOString(),
      }).eq("id", transaction.id);
      
      transaction.status = "approved";
    }
  }

  // Handle post-insert actions safely in background
  after(async () => {
    if (matchedOrder) {
      if (matchedOrder.action === "auto_execute") {
        log({ level: "info", event: "notification", message: `Payment auto-executed — Standing Order matched: ${matchedOrder.plain_language}` });
        
        if (finalQuorum <= 1) {
          await getServiceClient().from("transactions").update({
            status: "executing",
          }).eq("id", transaction.id);

          log({ level: "info", event: "monnify_auto_execute_transfer_triggered", transactionId: transaction.id });
          
          await fetch(
            `${process.env.NEXTAUTH_URL}/api/transfers`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                transactionId: transaction.id,
                vaultId,
              }),
            }
          );
        }
      } else if (matchedOrder.action === "notify_then_execute") {
        const windowHours = matchedOrder.notify_window_hours || 24;
        log({ level: "info", event: "notification", message: `Payment pending veto — Standing Order matched: ${matchedOrder.plain_language}` });
        
        setTimeout(async () => {
          log({ level: "info", event: "monnify_notify_then_execute_triggered", transactionId: txPayload.id });
          // In a real system, verify if it was vetoed before executing
        }, windowHours * 60 * 60 * 1000);
      } else if (matchedOrder.action === "operator_quorum_only") {
        log({ level: "info", event: "notification", message: `Payment routed to operators only — Standing Order matched.` });
      }
    } else {
      log({ level: "info", event: "notification", message: `New payment request requires full quorum.` });
    }
  });

  return Response.json({ 
    transaction: {
      ...transaction,
      approvals: autoApproveUserId ? [autoApproveUserId] : []
    }
  }, { status: 201 });
}
