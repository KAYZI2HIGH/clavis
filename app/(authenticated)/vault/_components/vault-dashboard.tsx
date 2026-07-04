"use client";

import { useState } from "react";
import { TransactionsList } from "@/components/vault/transactions-list";
import { VaultFooter } from "@/components/vault/vault-footer";
import { VaultHeader } from "@/components/vault/vault-header";
import { useActiveVault } from "@/hooks/use-vault";
import { ApprovalDialog } from "./approval-dialog";
import { RequestPayoutSheet } from "./request-payout-sheet";
import { SettingsDialog } from "./settings-dialog";
import { TxDetailSheet } from "./tx-detail-sheet";

export function VaultDashboard() {
  const vault = useActiveVault();
  const [requestOpen, setRequestOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);

  if (!vault) return null;

  return (
    <div className="min-h-screen bg-paper grain">
      <VaultHeader vault={vault} onSettings={() => setSettingsOpen(true)} />

      <main className="max-w-6xl mx-auto px-8 pb-24">
        <div className="flex items-end justify-between mt-10 mb-5">
          <div>
            <p className="engraved">Ledger</p>
            <p className="serif text-2xl text-ink mt-1">Transactions</p>
          </div>
          <button
            className="btn-mech btn-mech-primary"
            onClick={() => setRequestOpen(true)}
            disabled={vault.balanceKobo === 0}
          >
            Request Payout
          </button>
        </div>

        <div className="border hairline-strong bg-card">
          <TransactionsList
            vault={vault}
            onOpen={(id) => setDetailId(id)}
          />
        </div>
      </main>

      <RequestPayoutSheet
        vault={vault}
        open={requestOpen}
        onOpenChange={setRequestOpen}
      />
      <SettingsDialog
        vault={vault}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
      <TxDetailSheet
        vault={vault}
        txId={detailId}
        onClose={() => setDetailId(null)}
        onApprove={() => {
          setApprovalId(detailId);
          setDetailId(null);
        }}
      />
      <ApprovalDialog
        vault={vault}
        txId={approvalId}
        onClose={() => setApprovalId(null)}
      />

      <VaultFooter vault={vault} />
    </div>
  );
}
