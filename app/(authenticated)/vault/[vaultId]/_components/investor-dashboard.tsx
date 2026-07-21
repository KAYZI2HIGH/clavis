"use client";

import { useState } from "react";
import { TransactionsList } from "@/components/vault/transactions-list";
import { VaultFooter } from "@/components/vault/vault-footer";
import { VaultHeader } from "@/components/vault/vault-header";
import { useVaultRealtime } from "@/hooks/use-vault-realtime";
import { SettingsDialog } from "./settings-dialog";
import { TxDetailSheet } from "./tx-detail-sheet";
import { ApprovalDialog } from "./approval-dialog";
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

  // Exit
  const [exitExpanded, setExitExpanded] = useState(false);
  const exitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}/exit`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to request exit");
      return res.json();
    },
    onSuccess: () => {
      alert("Exit request sent. Operators have 14 days to respond.");
    }
  });

  // Settlement Preview
  const { data: settlementPreview } = useQuery({
    queryKey: ["vault", vaultId, "settlement-preview"],
    queryFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}/settlement/preview`);
      if (!res.ok) throw new Error("Failed to fetch settlement preview");
      return res.json();
    }
  });

  // Settlement Run
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const runSettlementMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}/settlement/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber, bankCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run settlement");
      return data;
    },
    onSuccess: () => {
      alert("Settlement run successfully!");
      qc.invalidateQueries({ queryKey: ["vault", vaultId] });
      qc.invalidateQueries({ queryKey: ["vault", vaultId, "settlement-preview"] });
    },
    onError: (err: Error) => {
      alert(err.message);
    }
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
  const currentMonthTx = (vault.transactions || []).filter(t => new Date(t.requested_at).getTime() >= startOfMonth);
  
  const revenueThisMonth = currentMonthTx
    .filter(t => t.is_inflow && t.inflow_account_type === 'revenue')
    .reduce((sum, t) => sum + Number(t.amount_kobo), 0);
    
  const capitalThisMonth = currentMonthTx
    .filter(t => t.is_inflow && t.inflow_account_type === 'capital')
    .reduce((sum, t) => sum + Number(t.amount_kobo), 0);

  // V2 specific fields (assuming they exist on the extended Vault type now)
  const standingOrders = (vault as any).standingOrders || [];
  const inflowClassifications = (vault as any).inflowClassifications || [];
  const flaggedCount = inflowClassifications.filter((c: any) => c.flagged_for_review).length;

  return (
    <div className="min-h-screen bg-paper grain pb-24">
      <ReconciliationBanner vaultId={vaultId} />
      <VaultHeader vault={vault} vaultId={vaultId} onSettings={() => setSettingsOpen(true)} />

      <main className="max-w-6xl mx-auto px-4 sm:px-8 space-y-8 mt-8">
        
        {/* INVESTMENT SUMMARY CARD */}
        <section>
          <p className="engraved mb-3">Investment Summary</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border hairline p-4">
              <p className="text-xs text-ink-muted mb-1">TOTAL INVESTED</p>
              <p className="mono text-lg text-ink">{formatNGN(totalInvested)}</p>
            </div>
            <div className="bg-card border hairline p-4">
              <p className="text-xs text-ink-muted mb-1">TOTAL RECEIVED</p>
              <p className="mono text-lg text-ink">{formatNGN(totalReceived)}</p>
            </div>
            <div className="bg-card border hairline p-4">
              <p className="text-xs text-ink-muted mb-1">EXIT ENTITLEMENT</p>
              <p className="mono text-lg text-ink">{formatNGN(exitEntitlement)}</p>
            </div>
            <div className="bg-card border hairline p-4">
              <p className="text-xs text-ink-muted mb-1">NEXT SETTLEMENT</p>
              <p className="mono text-lg text-ink">{settlementPreview?.settlement_date || "—"}</p>
              <p className="text-xs text-brass-deep mt-1">Est. {formatNGN(settlementPreview?.investor_share_kobo || 0)}</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* REVENUE INTEGRITY CARD */}
          <section>
            <p className="engraved mb-3">Revenue Integrity</p>
            <div className="bg-card border hairline p-5">
              {flaggedCount > 0 && (
                <div className="mb-4 bg-amber-50 border hairline border-amber-200 p-3 flex justify-between items-center cursor-pointer hover:bg-amber-100 transition-colors">
                  <p className="text-sm text-amber-900 font-medium">{flaggedCount} inflows need your review</p>
                  <span className="text-amber-700">→</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-ink-muted mb-1">REVENUE THIS MONTH</p>
                  <p className="mono text-lg text-emerald-700">{formatNGN(revenueThisMonth)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted mb-1">CAPITAL THIS MONTH</p>
                  <p className="mono text-lg text-indigo-700">{formatNGN(capitalThisMonth)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* SETTLEMENT PREVIEW CARD */}
          <section>
            <p className="engraved mb-3">Settlement Preview</p>
            <div className="bg-card border hairline p-5">
              {settlementPreview ? (
                <div>
                  <p className="text-sm font-medium mb-3">Settlement in {settlementPreview.days_remaining} days</p>
                  <div className="space-y-1 mb-3 text-sm">
                    <div className="flex justify-between"><span className="text-ink-muted">Revenue:</span><span className="mono">{formatNGN(settlementPreview.total_revenue_kobo)}</span></div>
                    <div className="flex justify-between"><span className="text-ink-muted">Expenses:</span><span className="mono">{formatNGN(settlementPreview.total_expenses_kobo)}</span></div>
                    <div className="flex justify-between font-medium"><span className="text-ink-muted">Profit Pool:</span><span className="mono">{formatNGN(settlementPreview.profit_pool_kobo)}</span></div>
                  </div>
                  <div className="border-t hairline pt-3 mb-4">
                    <div className="flex justify-between font-medium text-brass-deep">
                      <span>Your share ({settlementPreview.investor_share_percent}%):</span>
                      <span className="mono text-lg">{formatNGN(settlementPreview.investor_share_kobo)}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <input 
                      placeholder="Account Number" 
                      className="input-mech w-full" 
                      value={accountNumber}
                      onChange={e => setAccountNumber(e.target.value)}
                    />
                    <input 
                      placeholder="Bank Code (e.g. 058)" 
                      className="input-mech w-full" 
                      value={bankCode}
                      onChange={e => setBankCode(e.target.value)}
                    />
                  </div>

                  <button 
                    className="btn-mech btn-mech-primary w-full"
                    onClick={() => runSettlementMutation.mutate()}
                    disabled={runSettlementMutation.isPending || !accountNumber || !bankCode}
                  >
                    {runSettlementMutation.isPending ? "Processing..." : "Run Settlement"}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-ink-muted">Loading preview...</p>
              )}
            </div>
          </section>
        </div>

        {/* STANDING ORDERS PANEL */}
        <section>
          <p className="engraved mb-3">Standing Orders</p>
          <div className="bg-card border hairline">
            {standingOrders.length === 0 ? (
              <div className="p-6 text-center text-sm text-ink-muted">No active standing orders.</div>
            ) : (
              <div className="divide-y hairline">
                {standingOrders.map((so: any) => (
                  <div key={so.id} className="p-4 flex items-center justify-between gap-4">
                    <p className="text-sm text-ink">{so.plain_language}</p>
                    <span className="text-[10px] font-bold tracking-wider px-2 py-1 border hairline bg-secondary/30 whitespace-nowrap">
                      {so.action.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="p-3 border-t hairline bg-secondary/10">
              <button className="text-sm text-brass-deep hover:underline">Propose new order →</button>
            </div>
          </div>
        </section>

        {/* TRANSACTIONS FEED */}
        <section>
          <p className="engraved mb-3">Transactions Feed</p>
          <div className="border hairline bg-card">
            <TransactionsList
              vault={vault}
              onOpen={(id) => setDetailId(id)}
            />
          </div>
        </section>

        {/* EXIT CALCULATOR */}
        <section className="mt-12">
          <button 
            className="w-full text-left p-4 bg-secondary/20 border hairline flex justify-between items-center"
            onClick={() => setExitExpanded(!exitExpanded)}
          >
            <span className="serif text-lg">Exit this investment</span>
            <span>{exitExpanded ? "−" : "+"}</span>
          </button>
          
          {exitExpanded && (
            <div className="p-5 border hairline border-t-0 bg-card space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">You invested:</span><span className="mono">{formatNGN(totalInvested)}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">You've received:</span><span className="mono">{formatNGN(totalReceived)}</span></div>
              <div className="flex justify-between font-medium"><span className="text-ink-muted">Exit entitlement:</span><span className="mono">{formatNGN(exitEntitlement)}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Current vault balance:</span><span className="mono">{formatNGN(vault.balance_kobo)}</span></div>
              
              <div className="pt-3 mt-3 border-t hairline">
                <p className="font-medium mb-4">
                  {vault.balance_kobo >= exitEntitlement ? "Full exit available." : `Shortfall of ${formatNGN(exitEntitlement - vault.balance_kobo)}`}
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

      <VaultFooter vault={vault} vaultId={vaultId} />
    </div>
  );
}
