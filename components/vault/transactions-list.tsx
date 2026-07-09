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
  const requester = vault.stakeholders.find((s) => s.id === tx.requestedBy);
  return (
    <button
      onClick={() => onOpen(tx.id)}
      className="w-full px-4 sm:px-6 py-4 border-b hairline text-left hover:bg-secondary/60 transition-colors"
    >
      <div className="sm:grid sm:grid-cols-[1fr_140px_140px_120px_120px] sm:items-center">
        <div>
          <p className="text-sm text-ink">{tx.recipientName}</p>
          <p className="mono text-xs text-ink-faint mt-0.5">
            {tx.id} · Requested by {requester?.initials}
          </p>
        </div>
        <p className="mono text-sm text-ink mt-1 sm:mt-0 text-right">{formatNGN(tx.amountKobo)}</p>
        <p className="text-xs text-ink-muted mt-0.5 sm:mt-0">{formatTime(tx.requestedAt)}</p>
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
  const prevCountRef = useRef(vault.transactions.length);

  useEffect(() => {
    if (vault.transactions.length > prevCountRef.current) {
      const newestTx = vault.transactions[0];
      if (newestTx) {
        setJustAddedTxId(newestTx.id);
        const timer = setTimeout(() => setJustAddedTxId(null), 3000);
        return () => clearTimeout(timer);
      }
    }
    prevCountRef.current = vault.transactions.length;
  }, [vault.transactions]);

  const pendingMine = vault.transactions.filter(
    (t) => t.status === "pending" && !t.approvals.includes(current),
  );
  const rest = vault.transactions.filter((t) => !pendingMine.includes(t));

  if (vault.transactions.length === 0) {
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
        <div className="hidden sm:grid sm:grid-cols-[1fr_140px_140px_120px_120px] px-4 sm:px-6 py-3 border-b hairline">
          <p className="engraved">Recipient</p>
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
              <div className="sm:grid sm:grid-cols-[1fr_140px_140px_120px_120px] sm:items-center">
                <div>
                  <p className="text-sm text-ink">{t.recipientName}</p>
                  <p className="mono text-xs text-ink-faint mt-0.5">
                    {t.id} · {t.memo || "—"}
                  </p>
                </div>
                <p className="mono text-sm text-ink mt-1 sm:mt-0 text-right">
                  {formatNGN(t.amountKobo)}
                </p>
                <p className="text-xs text-ink-muted mt-0.5 sm:mt-0">{formatTime(t.requestedAt)}</p>
                <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                  {vault.stakeholders.map((p) => (
                    <KeyIcon key={p.id} filled={t.approvals.includes(p.id)} />
                  ))}
                  <span className="mono text-xs text-ink-muted ml-1">
                    {t.approvals.length}/{t.requiredQuorum}
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
