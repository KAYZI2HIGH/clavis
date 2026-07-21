"use client";

import { useState, useEffect, useRef } from "react";
import type { Transaction, Vault } from "@/lib/types";
// import { useVault } from "@/hooks/use-vault";
// TODO: Batch 4 - Replace with URL-based / React Query dynamic state logic
import { formatTime, formatNGN } from "@/lib/format";
import { KeyIcon } from "@/components/shared/key-icon";
import { StatusPill } from "@/components/shared/status-pill";

function PendingKeyRow({
  vault,
  tx,
  onOpen,
}: {
  vault: Vault;
  tx: Transaction;
  onOpen: (id: string) => void;
}) {
  const requester = (vault.stakeholders ?? []).find((s) => s.id === tx.requested_by);
  return (
    <button
      onClick={() => onOpen(tx.id)}
      className="w-full px-4 sm:px-6 py-4 border-b hairline text-left hover:bg-secondary/60 transition-colors"
    >
      <div className="sm:grid sm:grid-cols-[1fr_120px_140px_140px_120px_120px] sm:items-center gap-2">
        <div>
          <p className="text-sm text-ink">{tx.is_inflow ? (tx.narration || "Inflow") : tx.recipient_name}</p>
          <p className="mono text-xs text-ink-faint mt-0.5 truncate max-w-[200px]">
            {tx.id} · Req. by {requester?.initials} · {tx.memo || tx.narration || "—"}
          </p>
        </div>
        <div className="mt-1 sm:mt-0">
          <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 border hairline ${tx.is_inflow ? (tx.inflow_account_type === 'capital' ? 'bg-indigo-50/50 text-indigo-700' : 'bg-emerald-50/50 text-emerald-700') : 'bg-amber-50/50 text-amber-700'}`}>
            {tx.is_inflow ? (tx.inflow_account_type === 'capital' ? 'CAPITAL' : 'REVENUE') : 'PAYOUT'}
          </span>
        </div>
        <p className="mono text-sm text-ink mt-1 sm:mt-0 text-right">{formatNGN(tx.amount_kobo)}</p>
        <p className="text-xs text-ink-muted mt-0.5 sm:mt-0">{formatTime(new Date(tx.requested_at).getTime())}</p>
        <div />
        <div className="flex items-center justify-start sm:justify-end gap-2 mt-1 sm:mt-0">
          <KeyIcon outlined />
          <span className="engraved text-brass-deep">Your key</span>
        </div>
      </div>
    </button>
  );
}

export function TransactionsList({
  vault,
  onOpen,
}: {
  vault: Vault;
  onOpen: (id: string) => void;
}) {
  const current = vault.youId;
  const [justAddedTxId, setJustAddedTxId] = useState<string | null>(null);
  const prevCountRef = useRef((vault.transactions ?? []).length);

  useEffect(() => {
    if ((vault.transactions ?? []).length > prevCountRef.current) {
      const newestTx = (vault.transactions ?? [])[0];
      if (newestTx) {
        setJustAddedTxId(newestTx.id);
        const timer = setTimeout(() => setJustAddedTxId(null), 3000);
        return () => clearTimeout(timer);
      }
    }
    prevCountRef.current = (vault.transactions ?? []).length;
  }, [vault.transactions]);

  const pendingMine = (vault.transactions ?? []).filter(
    (t) => t.status === "pending" && !(t.approvals ?? []).includes(current ?? ""),
  );
  const rest = (vault.transactions ?? []).filter((t) => !pendingMine.includes(t));

  if ((vault.transactions ?? []).length === 0) {
    return (
      <div className="px-4 sm:px-6 py-12 text-center">
        <p className="text-sm text-ink-muted">
          No transactions yet.
        </p>
      </div>
    );
  }

  return (
    <>
      {pendingMine.length > 0 && (
        <div>
          <div className="px-4 sm:px-6 py-3 border-b hairline border-t hairline flex items-center gap-2 bg-brass-soft/40">
            <KeyIcon outlined />
            <p className="engraved text-brass-deep">Pending your key</p>
          </div>
          {pendingMine.map((t) => (
            <PendingKeyRow key={t.id} vault={vault} tx={t} onOpen={onOpen} />
          ))}
        </div>
      )}

      <div className="border-t hairline">
        <div className="hidden sm:grid sm:grid-cols-[1fr_120px_140px_140px_120px_120px] gap-2 px-4 sm:px-6 py-3 border-b hairline">
          <p className="engraved">Details</p>
          <p className="engraved">Type</p>
          <p className="engraved text-right">Amount</p>
          <p className="engraved">Requested</p>
          <p className="engraved">Keys</p>
          <p className="engraved text-right">Status</p>
        </div>
        {rest.map((t) => {
          const isNew = t.id === justAddedTxId;
          return (
            <button
              key={t.id}
              onClick={() => onOpen(t.id)}
              className={`w-full px-4 sm:px-6 py-4 border-b hairline text-left hover:bg-secondary/60 transition-colors ${
                isNew ? "bg-brass-soft/20 transition-all duration-1000" : ""
              }`}
            >
              <div className="sm:grid sm:grid-cols-[1fr_120px_140px_140px_120px_120px] sm:items-center gap-2">
                <div>
                  <p className="text-sm text-ink">{t.is_inflow ? (t.narration || "Inflow") : t.recipient_name}</p>
                  <p className="mono text-xs text-ink-faint mt-0.5 truncate max-w-[200px] sm:max-w-[250px]">
                    {t.id} · {t.memo || t.narration || "—"}
                  </p>
                </div>
                <div className="mt-1 sm:mt-0">
                  <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 border hairline ${t.is_inflow ? (t.inflow_account_type === 'capital' ? 'bg-indigo-50/50 text-indigo-700' : 'bg-emerald-50/50 text-emerald-700') : 'bg-amber-50/50 text-amber-700'}`}>
                    {t.is_inflow ? (t.inflow_account_type === 'capital' ? 'CAPITAL' : 'REVENUE') : 'PAYOUT'}
                  </span>
                </div>
                <p className="mono text-sm text-ink mt-1 sm:mt-0 text-right">
                  {formatNGN(t.amount_kobo)}
                </p>
                <p className="text-xs text-ink-muted mt-0.5 sm:mt-0">{formatTime(new Date(t.requested_at).getTime())}</p>
                <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                  {(vault.stakeholders ?? []).map((p) => (
                    <KeyIcon key={p.id} filled={(t.approvals ?? []).includes(p.id)} />
                  ))}
                  <span className="mono text-xs text-ink-muted ml-1">
                    {(t.approvals ?? []).length}/{t.required_quorum}
                  </span>
                </div>
                <div className="text-left sm:text-right mt-0.5 sm:mt-0">
                  <StatusPill status={t.status} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
