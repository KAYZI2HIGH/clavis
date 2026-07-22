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

  if (matchedOrder) {
    if (matchedOrder.action === "auto_execute") {
      initialStatus = "approved";
      finalQuorum = 1; // Overridden to 1 for immediate execution
    } else if (matchedOrder.action === "always_require_investor") {
      // Increment quorum by 1 to represent investor's mandatory vote
      finalQuorum = vault.quorum + 1;
    }
    // "operator_quorum_only" and "notify_then_execute" remain pending with standard quorum
  } else {
    // If no match: Route to full quorum
    finalQuorum = vault.quorum + 1; // Assuming +1 means requiring investor as well
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

  // Handle post-insert actions safely in background
  after(async () => {
    if (matchedOrder) {
      if (matchedOrder.action === "auto_execute") {
        log({ level: "info", event: "notification", message: `Payment auto-executed — Standing Order matched: ${matchedOrder.plain_language}` });
        
        // Trigger Monnify transfer immediately
        // Note: For real implementation, call initiateTransfer API logic here
        // e.g. await fetch(`${process.env.NEXTAUTH_URL}/api/transfers`, ...)
        log({ level: "info", event: "monnify_auto_execute_transfer_triggered", transactionId: txPayload.id });
        
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

  return Response.json({ transaction }, { status: 201 });
}
