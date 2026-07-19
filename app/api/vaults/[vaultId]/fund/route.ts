import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/logger";
import { createReservedAccount } from "@/lib/monnify/accounts";

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

  // 1. Fetch vault
  const { data: vault, error: vaultError } = await getServiceClient()
    .from("vaults")
    .select("name, status, investor_id, revenue_account_number, revenue_account_bank, capital_account_number, capital_account_bank")
    .eq("id", vaultId)
    .single();

  if (vaultError || !vault) {
    return Response.json({ error: "Vault not found" }, { status: 404 });
  }

  // 2. Confirm requester is the vault investor
  const { data: investor, error: shError } = await getServiceClient()
    .from("stakeholders")
    .select("id")
    .eq("vault_id", vaultId)
    .eq("is_investor", true)
    .eq("id", vault.investor_id)
    .or(email && phone ? `email.eq.${email},phone.eq.${phone}` : email ? `email.eq.${email}` : `phone.eq.${phone}`)
    .single();

  if (shError || !investor) {
    return Response.json({ error: "Unauthorized to fund vault" }, { status: 403 });
  }

  // Idempotent return if accounts already exist
  if (vault.revenue_account_number && vault.capital_account_number) {
    return Response.json({
      revenueAccount: {
        accountNumber: vault.revenue_account_number,
        bankName: vault.revenue_account_bank,
      },
      capitalAccount: {
        accountNumber: vault.capital_account_number,
        bankName: vault.capital_account_bank,
      }
    });
  }

  try {
    // 3 & 4. Call createRevenueAccount and createCapitalAccount from Monnify
    // We use createReservedAccount from lib/monnify/accounts.ts
    const [revenueRes, capitalRes] = await Promise.all([
      createReservedAccount({
        accountReference: `REV-${vaultId}`,
        accountName: `${vault.name} Revenue`,
        customerEmail: email ?? "support@clavis.com",
        customerName: session.user.name ?? "Vault Investor",
      }),
      createReservedAccount({
        accountReference: `CAP-${vaultId}`,
        accountName: `${vault.name} Capital`,
        customerEmail: email ?? "support@clavis.com",
        customerName: session.user.name ?? "Vault Investor",
      })
    ]);

    // Parse the Monnify response to extract account number and bank name
    // Monnify returns an array of accounts inside responseBody.accounts
    const revAcct = revenueRes.responseBody.accounts[0];
    const capAcct = capitalRes.responseBody.accounts[0];

    const revenue_account_number = revAcct.accountNumber;
    const revenue_account_bank = revAcct.bankName;
    const capital_account_number = capAcct.accountNumber;
    const capital_account_bank = capAcct.bankName;

    // 5. Update vault
    const { error: updateError } = await getServiceClient()
      .from("vaults")
      .update({
        revenue_account_number,
        revenue_account_bank,
        capital_account_number,
        capital_account_bank,
        updated_at: new Date().toISOString(),
      })
      .eq("id", vaultId);

    if (updateError) {
      throw new Error(`Failed to update vault: ${updateError.message}`);
    }

    // 6. Return both account details
    return Response.json({
      revenueAccount: {
        accountNumber: revenue_account_number,
        bankName: revenue_account_bank,
      },
      capitalAccount: {
        accountNumber: capital_account_number,
        bankName: capital_account_bank,
      }
    });
  } catch (error) {
    log({
      level: "error",
      event: "vault_funding_accounts_failed",
      vaultId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Failed to create funding accounts" }, { status: 500 });
  }
}
