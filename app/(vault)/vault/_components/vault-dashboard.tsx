"use client";

import { useState } from "react";
import { EmptyVault } from "@/components/vault/empty-vault";
import { TransactionsList } from "@/components/vault/transactions-list";
import { VaultFooter } from "@/components/vault/vault-footer";
import { VaultHeader } from "@/components/vault/vault-header";
import { useVault } from "@/hooks/use-vault";
import { ApprovalDialog } from "./approval-dialog";
import { RequestPayoutSheet } from "./request-payout-sheet";
import { SettingsSheet } from "./settings-sheet";
import { TxDetailSheet } from "./tx-detail-sheet";

export function VaultDashboard() {
  const { state } = useVault();
  const { balanceCents, transactions } = state;
  const txCount = transactions.length;
  const [requestOpen, setRequestOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);

  const showEmpty = balanceCents === 0 && txCount === 0;

  return (
    <div className="min-h-screen bg-paper grain">
      <VaultHeader onSettings={() => setSettingsOpen(true)} />

      <main className="max-w-6xl mx-auto px-8 pb-24">
        {showEmpty ? (
          <EmptyVault />
        ) : (
          <>
            <div className="flex items-end justify-between mt-10 mb-5">
              <div>
                <p className="engraved">Ledger</p>
                <p className="serif text-2xl text-ink mt-1">Transactions</p>
              </div>
              <button
                className="btn-mech btn-mech-primary"
                onClick={() => setRequestOpen(true)}
                disabled={balanceCents === 0}
              >
                Request Payout
              </button>
            </div>

            <div className="border hairline-strong bg-card">
              <TransactionsList onOpen={(id) => setDetailId(id)} />
            </div>
          </>
        )}
      </main>

      <RequestPayoutSheet open={requestOpen} onOpenChange={setRequestOpen} />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <TxDetailSheet
        txId={detailId}
        onClose={() => setDetailId(null)}
        onApprove={() => {
          setApprovalId(detailId);
          setDetailId(null);
        }}
      />
      <ApprovalDialog txId={approvalId} onClose={() => setApprovalId(null)} />

      <VaultFooter />
    </div>
  );
}
