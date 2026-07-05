import { getServiceClient } from "@/lib/supabase/service";
import { nombaFetch } from "@/lib/nomba/client";
import { log } from "@/lib/logger";
import { getNombaSubaccountId } from "@/lib/nomba/env";
import { incrementVaultBalanceKobo } from "@/lib/supabase/vault-balance";

// Verify Vercel Cron secret
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all vaults that have a Nomba virtual account
  const { data: vaults } = await getServiceClient()
    .from("vaults")
    .select("id, name, balance_kobo, quorum, nomba_virtual_account_number")
    .not("nomba_virtual_account_number", "is", null);

  if (!vaults || vaults.length === 0) {
    return Response.json({ message: "No vaults to reconcile" });
  }

  const results = [];

  for (const vault of vaults) {
    const result = await reconcileVault(vault.id, vault.nomba_virtual_account_number || "");
    results.push(result);
  }

  return Response.json({ reconciled: results });
}

async function reconcileVault(vaultId: string, virtualAccount: string) {
  const resolved: string[] = [];
  const orphansCredited: string[] = [];
  const critical: string[] = [];

  // Date range: look back 30 days formatted as YYYY-MM-DDTHH:mm:ss
  const formatReconDate = (date: Date) => date.toISOString().split(".")[0];
  const dateTo = formatReconDate(new Date(Date.now() + 24 * 60 * 60 * 1000)); // Include tomorrow to prevent timezone edge cases
  const dateFrom = formatReconDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  // Fetch transactions from Nomba for this period scoping it to our account
  let nombaTransactions: any[] = [];
  try {
    const res = await nombaFetch<any>(
      `/transactions/accounts/${getNombaSubaccountId()}?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      { method: "GET", merchantTxRef: `recon-${vaultId}` }
    );
    
    // Log the raw response for debugging purposes
    log({
      level: "info",
      event: "reconciliation_raw_nomba_response",
      vaultId,
      rawResponse: JSON.stringify(res),
    });
    
    nombaTransactions = res?.data?.results ?? res?.data?.transactions ?? [];
  } catch (err) {
    log({
      level: "error",
      event: "reconciliation_nomba_fetch_failed",
      vaultId,
      merchantTxRef: `recon-${vaultId}`,
      error: err instanceof Error ? err.message : String(err),
    });
    return { vaultId, status: "error" };
  }

  let totalChecked = nombaTransactions.length;

  for (const nombaTx of nombaTransactions) {
    const ref = nombaTx.id || nombaTx.paymentVendorReference || nombaTx.merchantTxRef;
    if (!ref) continue;

    // Find matching transaction in our DB
    const { data: localTx } = await getServiceClient()
      .from("transactions")
      .select("id, status, amount_kobo, vault_id")
      .eq("nomba_tx_ref", ref)
      .maybeSingle();

    // Case 1: Nomba says success, we say executing → settle it
    if (
      nombaTx.status?.toUpperCase() === "SUCCESS" &&
      localTx?.status === "executing"
    ) {
      await getServiceClient()
        .from("transactions")
        .update({ 
          status: "settled",
          settled_at: new Date().toISOString(),
        })
        .eq("id", localTx.id);

      const msg = `Settled tx ${ref} — was stuck in executing`;
      resolved.push(msg);
      log({
        level: "info",
        event: "reconciliation_settled",
        merchantTxRef: ref,
        vaultId,
      });
    }

    // Case 2: Nomba says failed, we say settled → critical
    if (
      nombaTx.status?.toUpperCase() === "FAILED" &&
      localTx?.status === "settled"
    ) {
      const msg = `CRITICAL: tx ${ref} settled in our DB but failed on Nomba`;
      critical.push(msg);
      log({
        level: "error",
        event: "reconciliation_critical_mismatch",
        merchantTxRef: ref,
        vaultId,
      });
    }

    // Case 3: Nomba says failed, we say executing → fail it + refund
    if (
      nombaTx.status?.toUpperCase() === "FAILED" &&
      localTx?.status === "executing"
    ) {
      // Update transaction to failed
      await getServiceClient()
        .from("transactions")
        .update({ status: "failed" })
        .eq("id", localTx.id);

      // Refund vault balance
      await getServiceClient().rpc("increment_vault_balance", {
        vault_id: localTx.vault_id,
        amount_kobo: localTx.amount_kobo,
      });

      const msg = `Refunded ${ref} — transfer failed, balance restored`;
      resolved.push(msg);
      log({
        level: "info",
        event: "reconciliation_refunded",
        merchantTxRef: ref,
        vaultId,
      });
    }

    // Case 4: Exists on Nomba but not in our DB at all
    // Only handle incoming credits (virtual account funding)
    const isCredit = 
      nombaTx.type?.toLowerCase() === "credit" || 
      nombaTx.type?.toLowerCase() === "vact_transfer" ||
      nombaTx.transactionType?.toLowerCase() === "vact_transfer";

    // Verify this transaction actually belongs to this vault's virtual account
    // Nomba transactions list stores the destination virtual account in recipientAccountNumber
    const isForThisVault = 
      nombaTx.recipientAccountNumber === virtualAccount ||
      nombaTx.customerBillerId === virtualAccount;

    if (!localTx && isCredit && isForThisVault && 
        nombaTx.status?.toUpperCase() === "SUCCESS") {
      const amountKobo = Math.round(Number(nombaTx.amount) * 100);

      // Credit vault balance
      await incrementVaultBalanceKobo(vaultId, amountKobo);

      // Insert transaction record
      await getServiceClient()
        .from("transactions")
        .insert({
          vault_id: vaultId,
          amount_kobo: amountKobo,
          status: "settled",
          narration: "Vault funded (reconciled)",
          nomba_tx_ref: ref,
          requested_at: new Date().toISOString(),
          settled_at: new Date().toISOString(),
        });

      const msg = `Credited ${ref} — missed webhook, balance restored`;
      orphansCredited.push(msg);
      log({
        level: "info",
        event: "reconciliation_orphan_credited",
        merchantTxRef: ref,
        vaultId,
      });
    }

    // Case 5: Exists on both sides but amount mismatch
    // (e.g. from the previous Naira-vs-Kobo mapping bug)
    if (localTx && nombaTx.status?.toUpperCase() === "SUCCESS") {
      const nombaAmountKobo = Math.round(Number(nombaTx.amount) * 100);
      if (nombaAmountKobo !== localTx.amount_kobo) {
        const diffKobo = nombaAmountKobo - localTx.amount_kobo;

        // Correct the transaction amount in the database
        await getServiceClient()
          .from("transactions")
          .update({ amount_kobo: nombaAmountKobo })
          .eq("id", localTx.id);

        // Adjust the vault balance with the difference
        await incrementVaultBalanceKobo(vaultId, diffKobo);

        const msg = `Adjusted ${ref} — fixed amount mismatch of ${(diffKobo / 100).toFixed(2)} Naira, balance restored`;
        resolved.push(msg);
        log({
          level: "info",
          event: "reconciliation_amount_adjusted",
          merchantTxRef: ref,
          vaultId,
          diffKobo,
        });
      }
    }
  }

  // Determine overall status
  const status =
    critical.length > 0
      ? "critical"
      : resolved.length > 0 || orphansCredited.length > 0
        ? "resolved"
        : "clean";

  // Write reconciliation log to Supabase
  await getServiceClient()
    .from("reconciliation_logs")
    .insert({
      vault_id: vaultId,
      run_at: new Date().toISOString(),
      total_checked: totalChecked,
      discrepancies_found:
        resolved.length + orphansCredited.length + critical.length,
      resolved,
      orphans_credited: orphansCredited,
      critical,
      status,
    });

  return { 
    vaultId, 
    status, 
    resolved, 
    orphansCredited, 
    critical 
  };
}
