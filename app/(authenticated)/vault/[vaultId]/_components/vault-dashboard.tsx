"use client";

import { useState } from "react";
import { TransactionsList } from "@/components/vault/transactions-list";
import { VaultFooter } from "@/components/vault/vault-footer";
import { VaultHeader } from "@/components/vault/vault-header";
import { useVaultRealtime } from "@/hooks/use-vault-realtime";
import { ApprovalDialog } from "./approval-dialog";
import { RequestPayoutSheet } from "./request-payout-sheet";
import { SettingsDialog } from "./settings-dialog";
import { TxDetailSheet } from "./tx-detail-sheet";
import { ReconciliationBanner } from "@/components/vault/reconciliation-banner";
import type { Vault } from "@/lib/types";

interface VaultDashboardProps {
  vault: Vault;
  vaultId: string;
}

export function VaultDashboard({ vault, vaultId }: VaultDashboardProps) {
  useVaultRealtime(vaultId);
  const [requestOpen, setRequestOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);

  if (!vault) return null;

  return (
    <div className="min-h-screen bg-paper grain">
      <ReconciliationBanner vaultId={vaultId} />
      <VaultHeader vault={vault} vaultId={vaultId} onSettings={() => setSettingsOpen(true)} />

      <main className="max-w-6xl mx-auto px-4 sm:px-8 pb-24">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mt-10 mb-5 gap-4">
          <div>
            <p className="engraved">Ledger</p>
            <p className="serif text-2xl text-ink mt-1">Transactions</p>
          </div>
          <button
            className="btn-mech btn-mech-primary w-full sm:w-auto"
            onClick={() => setRequestOpen(true)}
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
        vaultId={vaultId}
        open={requestOpen}
        onOpenChange={setRequestOpen}
      />
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
