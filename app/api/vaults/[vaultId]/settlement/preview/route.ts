import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET(
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

  // Confirm user is the investor of this vault
  const { data: vault, error: vaultErr } = await getServiceClient()
    .from("vaults")
    .select("investor_id, investor_profit_share, settlement_day, investment_type")
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
    return Response.json({ error: "Only the investor can preview settlements" }, { status: 403 });
  }

  // Calculate current month's start date
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // 1. Calculate Total Revenue (Inflows designated as revenue)
  const { data: revenueData } = await getServiceClient()
    .from("transactions")
    .select("amount_kobo")
    .eq("vault_id", vaultId)
    .eq("is_inflow", true)
    .eq("inflow_account_type", "revenue")
    .gte("requested_at", startOfMonth);

  const total_revenue_kobo = (revenueData ?? []).reduce((sum, tx) => sum + Number(tx.amount_kobo), 0);

  // 2. Calculate Total Expenses (Settled outflows)
  const { data: expenseData } = await getServiceClient()
    .from("transactions")
    .select("amount_kobo")
    .eq("vault_id", vaultId)
    .eq("is_inflow", false)
    .eq("status", "settled")
    .gte("requested_at", startOfMonth);

  const total_expenses_kobo = (expenseData ?? []).reduce((sum, tx) => sum + Number(tx.amount_kobo), 0);

  // 3. Profit Pool & Investor Share
  const profit_pool_kobo = Math.max(0, total_revenue_kobo - total_expenses_kobo);
  
  let investor_share_kobo = 0;
  if (vault.investment_type === "profit_share" && vault.investor_profit_share) {
    investor_share_kobo = Math.floor(profit_pool_kobo * (vault.investor_profit_share / 100));
  } else if (vault.investment_type === "fixed_return") {
    // Basic mock for fixed return if needed, but assuming profit share mostly
    investor_share_kobo = Math.floor(profit_pool_kobo * ((vault.investor_profit_share || 0) / 100));
  } else {
    investor_share_kobo = Math.floor(profit_pool_kobo * ((vault.investor_profit_share || 0) / 100));
  }

  // 4. Calculate Settlement Date & Days Remaining
  let settlement_date = new Date(now.getFullYear(), now.getMonth(), vault.settlement_day || 28);
  if (now > settlement_date) {
    // Move to next month
    settlement_date = new Date(now.getFullYear(), now.getMonth() + 1, vault.settlement_day || 28);
  }

  const days_remaining = Math.ceil((settlement_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const settlementDateFormatted = settlement_date.toLocaleString('default', { month: 'long', day: 'numeric', year: 'numeric' });

  return Response.json({
    period: monthName,
    settlement_date: settlementDateFormatted,
    days_remaining,
    total_revenue_kobo,
    total_expenses_kobo,
    profit_pool_kobo,
    investor_share_kobo,
    investor_share_percent: vault.investor_profit_share || 0,
  });
}
