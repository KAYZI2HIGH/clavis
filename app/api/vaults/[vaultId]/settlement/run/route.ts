import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { makeId } from "@/lib/vault-utils";
import { initiateTransfer } from "@/lib/monnify/transfers";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultId } = await params;
  const email = session.user.email;
  const phone = session.user.phone;

  if (!email && !phone) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { accountNumber, bankCode } = body;

  if (!accountNumber || !bankCode) {
    return Response.json({ error: "Account Number and Bank Code are required for payout" }, { status: 400 });
  }

  // 1. Re-calculate figures
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: vault, error: vaultErr } = await getServiceClient()
    .from("vaults")
    .select("investor_id, investor_profit_share, balance_kobo, total_settled_kobo")
    .eq("id", vaultId)
    .single();

  if (vaultErr || !vault) {
    return Response.json({ error: "Vault not found" }, { status: 404 });
  }

  const { data: stakeholder } = await getServiceClient()
    .from("stakeholders")
    .select("id")
    .eq("vault_id", vaultId)
    .eq("id", vault.investor_id)
    .or(email && phone ? `email.eq.${email},phone.eq.${phone}` : email ? `email.eq.${email}` : `phone.eq.${phone}`)
    .single();

  if (!stakeholder) {
    return Response.json({ error: "Only the investor can run settlements" }, { status: 403 });
  }

  const { data: revenueData } = await getServiceClient()
    .from("transactions")
    .select("amount_kobo")
    .eq("vault_id", vaultId)
    .eq("is_inflow", true)
    .eq("inflow_account_type", "revenue")
    .gte("requested_at", startOfMonth);

  const total_revenue_kobo = (revenueData ?? []).reduce((sum, tx) => sum + Number(tx.amount_kobo), 0);

  const { data: expenseData } = await getServiceClient()
    .from("transactions")
    .select("amount_kobo")
    .eq("vault_id", vaultId)
    .eq("is_inflow", false)
    .eq("status", "settled")
    .gte("requested_at", startOfMonth);

  const total_expenses_kobo = (expenseData ?? []).reduce((sum, tx) => sum + Number(tx.amount_kobo), 0);

  const profit_pool_kobo = Math.max(0, total_revenue_kobo - total_expenses_kobo);
  const investor_share_kobo = Math.floor(profit_pool_kobo * ((vault.investor_profit_share || 0) / 100));

  if (investor_share_kobo <= 0) {
    return Response.json({ error: "No profit available to settle" }, { status: 400 });
  }

  if (investor_share_kobo > vault.balance_kobo) {
    return Response.json({ error: "Insufficient vault balance for settlement" }, { status: 400 });
  }

  // 2. Create settlement record
  const settlementId = makeId("stl");
  const { error: insertErr } = await getServiceClient()
    .from("settlements")
    .insert({
      id: settlementId,
      vault_id: vaultId,
      period_start: startOfMonth,
      period_end: now.toISOString(),
      total_revenue_kobo,
      total_expenses_kobo,
      profit_pool_kobo,
      investor_share_kobo,
      investor_profit_share: vault.investor_profit_share || 0,
      status: "processing",
      created_at: now.toISOString(),
    });

  if (insertErr) {
    log({ level: "error", event: "settlement_record_failed", vaultId, error: insertErr.message });
    return Response.json({ error: "Failed to record settlement" }, { status: 500 });
  }

  // 3. Trigger Monnify Transfer
  const ref = makeId("stl_tx");
  try {
    const transferRes = await initiateTransfer({
      amountKobo: investor_share_kobo,
      reference: ref,
      narration: "Clavis Vault Settlement",
      destinationBankCode: bankCode,
      destinationAccountNumber: accountNumber,
    });

    if (!transferRes.requestSuccessful) {
      throw new Error(transferRes.responseMessage);
    }

    // 4. Update status and balance
    await getServiceClient().from("settlements").update({
      status: "completed",
      settled_at: new Date().toISOString(),
      monnify_transfer_ref: transferRes.responseBody?.reference || ref,
    }).eq("id", settlementId);

    await getServiceClient().from("vaults").update({
      balance_kobo: vault.balance_kobo - investor_share_kobo,
      total_settled_kobo: Number(vault.total_settled_kobo || 0) + investor_share_kobo,
      updated_at: new Date().toISOString(),
    }).eq("id", vaultId);

    // Also record it as an outgoing transaction so ledger balances
    await getServiceClient().from("transactions").insert({
      id: makeId("tx"),
      vault_id: vaultId,
      requested_by: stakeholder.id,
      recipient_name: "Investor Payout",
      recipient_account: accountNumber,
      recipient_bank_code: bankCode,
      amount_kobo: investor_share_kobo,
      memo: "Settlement payout",
      narration: "Clavis Vault Settlement",
      status: "settled",
      required_quorum: 1,
      settled_at: new Date().toISOString(),
      monnify_tx_ref: transferRes.responseBody?.reference || ref,
      is_inflow: false,
      requested_at: new Date().toISOString(),
    });

    return Response.json({ success: true, settlementId });

  } catch (err) {
    log({ level: "error", event: "settlement_transfer_failed", vaultId, error: err instanceof Error ? err.message : String(err) });
    
    await getServiceClient().from("settlements").update({
      status: "failed"
    }).eq("id", settlementId);

    return Response.json({ error: "Transfer failed: " + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
