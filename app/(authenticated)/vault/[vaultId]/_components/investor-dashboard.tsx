"use client";

import { useState } from "react";
import { TransactionsList } from "@/components/vault/transactions-list";
import { VaultFooter } from "@/components/vault/vault-footer";
import { VaultHeader } from "@/components/vault/vault-header";
import { useVaultRealtime } from "@/hooks/use-vault-realtime";
import { SettingsDialog } from "./settings-dialog";
import { TxDetailSheet } from "./tx-detail-sheet";
import { ApprovalDialog } from "./approval-dialog";
import { SettlementDialog } from "./settlement-dialog";
import { ReconciliationBanner } from "@/components/vault/reconciliation-banner";
import type { Vault } from "@/lib/types";
import { formatNGN } from "@/lib/format";
import { KeyIcon } from "@/components/shared/key-icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface InvestorDashboardProps {
  vault: Vault;
  vaultId: string;
}

export function InvestorDashboard({ vault, vaultId }: InvestorDashboardProps) {
  useVaultRealtime(vaultId);
  const qc = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);

  // Exit
  const [exitExpanded, setExitExpanded] = useState(false);
  const exitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}/exit`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to request exit");
      return res.json();
    },
    onSuccess: () => {
      alert("Exit request sent. Operators have 14 days to respond.");
    },
  });

  // Calculate settlement preview for the summary panel (since we removed the big preview card)
  const { data: settlementPreview } = useQuery({
    queryKey: ["vault", vaultId, "settlement-preview"],
    queryFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}/settlement/preview`);
      if (!res.ok) throw new Error("Failed to fetch settlement preview");
      return res.json();
    },
  });

  if (!vault) return null;

  // Investment Summary Calculations
  const totalInvested = vault.total_invested_kobo || 0;
  const totalReceived = vault.total_settled_kobo || 0;
  const exitEntitlement = Math.max(0, totalInvested - totalReceived);

  // Revenue Integrity
  // Filter current month's transactions manually since we don't have an API just for this section's raw breakdown
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const currentMonthTx = (vault.transactions || []).filter(
    (t) => new Date(t.requested_at).getTime() >= startOfMonth,
  );

  const revenueThisMonth = currentMonthTx
    .filter((t) => t.is_inflow && t.inflow_account_type === "revenue")
    .reduce((sum, t) => sum + Number(t.amount_kobo), 0);

  const capitalThisMonth = currentMonthTx
    .filter((t) => t.is_inflow && t.inflow_account_type === "capital")
    .reduce((sum, t) => sum + Number(t.amount_kobo), 0);

  const inflowTotal = revenueThisMonth + capitalThisMonth;
  const revenueShare =
    inflowTotal > 0 ? Math.round((revenueThisMonth / inflowTotal) * 100) : 0;

  // V2 specific fields (assuming they exist on the extended Vault type now)
  const standingOrders = (vault as any).standingOrders || [];
  const inflowClassifications = (vault as any).inflowClassifications || [];
  const flaggedCount = inflowClassifications.filter(
    (c: any) => c.flagged_for_review,
  ).length;

  const exitShortfall = Math.max(0, exitEntitlement - vault.balance_kobo);
  const exitAvailable = vault.balance_kobo >= exitEntitlement;

  return (
    <div className="min-h-screen bg-paper grain pb-24">
      <ReconciliationBanner vaultId={vaultId} />
      <VaultHeader
        vault={vault}
        vaultId={vaultId}
        onSettings={() => setSettingsOpen(true)}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-8 space-y-10 mt-8">
        {/* INVESTMENT SUMMARY — ledger panel, not equal-weight cards */}
        <section>
          <p className="engraved mb-3">Investment Summary</p>
          <div className="bg-card border hairline grid grid-cols-1 sm:grid-cols-[1.3fr,1fr]">
            <div className="p-6 sm:border-r hairline flex flex-col justify-center">
              <p className="text-xs text-ink-muted tracking-wide mb-2">
                EXIT ENTITLEMENT
              </p>
              <p className="mono text-3xl text-ink">
                {formatNGN(exitEntitlement)}
              </p>
              <p className="text-xs text-ink-muted mt-2">
                Outstanding capital owed to you if you exit today
              </p>
            </div>
            <div className="divide-y hairline">
              <div className="flex justify-between items-center px-6 py-3">
                <span className="text-xs text-ink-muted">Total invested</span>
                <span className="mono text-sm text-ink">
                  {formatNGN(totalInvested)}
                </span>
              </div>
              <div className="flex justify-between items-center px-6 py-3">
                <span className="text-xs text-ink-muted">Total received</span>
                <span className="mono text-sm text-ink">
                  {formatNGN(totalReceived)}
                </span>
              </div>
              <div className="flex justify-between items-center px-6 py-3 bg-secondary/10">
                <div>
                  <span className="text-xs text-ink-muted block">
                    Next settlement
                  </span>
                  <span className="text-[11px] text-brass-deep">
                    {settlementPreview?.settlement_date || "—"}
                  </span>
                </div>
                <span className="mono text-sm text-ink">
                  {formatNGN(settlementPreview?.investor_share_kobo || 0)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* TRANSACTIONS FEED */}
        <section>
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-5 gap-4">
            <div>
              <p className="engraved">Ledger</p>
              <p className="serif text-2xl text-ink mt-1">Transactions</p>
            </div>
            <button
              className="btn-mech btn-mech-primary w-full sm:w-auto"
              onClick={() => setSettlementOpen(true)}
            >
              Run Settlement
            </button>
          </div>
          <div className="border hairline bg-card">
            <TransactionsList
              vault={vault}
              onOpen={(id) => setDetailId(id)}
            />
          </div>
        </section>



        {/* STANDING ORDERS */}
        <section>
          <p className="engraved mb-3">Standing Orders</p>
          <div className="bg-card border hairline">
            {standingOrders.length === 0 ?
              <div className="p-6 text-center text-sm text-ink-muted">
                No active standing orders.
              </div>
            : <div className="divide-y hairline">
                {standingOrders.map((so: any) => (
                  <div
                    key={so.id}
                    className="p-4 flex items-center justify-between gap-4"
                  >
                    <p className="text-sm text-ink">{so.plain_language}</p>
                    <span className="text-[10px] font-bold tracking-wider px-2 py-1 border hairline bg-secondary/30 whitespace-nowrap">
                      {so.action.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            }
            <div className="p-3 border-t hairline bg-secondary/10">
              <button className="text-sm text-brass-deep hover:underline">
                Propose new order →
              </button>
            </div>
          </div>
        </section>

        {/* EXIT — doesn't restate the summary above, just answers "can I exit" */}
        <section className="mt-12">
          <button
            className="w-full text-left p-4 bg-secondary/20 border hairline flex justify-between items-center"
            onClick={() => setExitExpanded(!exitExpanded)}
          >
            <span className="serif text-lg">Exit this investment</span>
            <span>{exitExpanded ? "−" : "+"}</span>
          </button>

          {exitExpanded && (
            <div className="p-5 border hairline border-t-0 bg-card space-y-4 text-sm">
              <div className="flex justify-between items-baseline">
                <span className="text-ink-muted">Current vault balance</span>
                <span className="mono text-ink">
                  {formatNGN(vault.balance_kobo)}
                </span>
              </div>

              <div className="border-t hairline pt-4">
                <p className="font-medium mb-4">
                  {exitAvailable ?
                    "Full exit available — the vault can cover your entitlement today."
                  : `Shortfall of ${formatNGN(exitShortfall)} against your entitlement.`
                  }
                </p>
                <button
                  className="btn-mech btn-mech-danger w-full sm:w-auto"
                  onClick={() => exitMutation.mutate()}
                  disabled={exitMutation.isPending}
                >
                  {exitMutation.isPending ? "Requesting..." : "Request Exit"}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      <SettingsDialog
        vault={vault}
        vaultId={vaultId}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
      <TxDetailSheet
        vault={vault}
        vaultId={vaultId}
        txId={detailId}
        onClose={() => setDetailId(null)}
        onApprove={() => {
          setApprovalId(detailId);
          setDetailId(null);
        }}
      />
      <ApprovalDialog
        vault={vault}
        vaultId={vaultId}
        txId={approvalId}
        onClose={() => setApprovalId(null)}
      />
      <SettlementDialog
        vault={vault}
        vaultId={vaultId}
        open={settlementOpen}
        onOpenChange={setSettlementOpen}
      />

      <VaultFooter
        vault={vault}
        vaultId={vaultId}
      />
    </div>
  );
}
