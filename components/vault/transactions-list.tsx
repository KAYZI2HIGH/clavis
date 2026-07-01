"use client";

import { useMembers, usePartnerById } from "@/hooks/use-member";
import { useVault } from "@/hooks/use-vault";
import { formatTime, formatUSD } from "@/lib/format";
import { QUORUM } from "@/lib/mock-data";
import type { Transaction } from "@/lib/types";
import { KeyIcon } from "@/components/shared/key-icon";
import { StatusPill } from "@/components/shared/status-pill";

function PendingKeyRow({
  tx,
  onOpen,
}: {
  tx: Transaction;
  onOpen: (id: string) => void;
}) {
  const partnerById = usePartnerById();
  return (
    <button
      onClick={() => onOpen(tx.id)}
      className="w-full grid grid-cols-[1fr_140px_140px_120px_120px] px-6 py-4 border-b hairline text-left items-center hover:bg-secondary/60 transition-colors"
    >
      <div>
        <p className="text-sm text-ink">{tx.recipientName}</p>
        <p className="mono text-xs text-ink-faint mt-0.5">
          {tx.id} · Requested by {partnerById(tx.requestedBy)?.initials}
        </p>
      </div>
      <p className="mono text-sm text-ink text-right">{formatUSD(tx.amount)}</p>
      <p className="text-xs text-ink-muted">{formatTime(tx.requestedAt)}</p>
      <div />
      <div className="flex items-center justify-end gap-2">
        <KeyIcon outlined />
        <span className="engraved text-brass-deep">Your key</span>
      </div>
    </button>
  );
}

export function TransactionsList({ onOpen }: { onOpen: (id: string) => void }) {
  const { state } = useVault();
  const { transactions, currentPartner } = state;
  const members = useMembers();

  const pendingMine = transactions.filter(
    (t) => t.status === "pending" && !t.approvals.includes(currentPartner),
  );
  const rest = transactions.filter((t) => !pendingMine.includes(t));

  if (transactions.length === 0) {
    return (
      <div className="border-t hairline py-16 text-center">
        <p className="engraved text-ink-faint">No transactions yet</p>
        <p className="text-sm text-ink-muted mt-2">
          Request a payout to begin the ledger.
        </p>
      </div>
    );
  }

  return (
    <>
      {pendingMine.length > 0 && (
        <div>
          <div className="px-6 py-3 border-b hairline border-t hairline flex items-center gap-2 bg-brass-soft/40">
            <KeyIcon outlined />
            <p className="engraved text-brass-deep">Pending your key</p>
          </div>
          {pendingMine.map((t) => (
            <PendingKeyRow key={t.id} tx={t} onOpen={onOpen} />
          ))}
        </div>
      )}

      <div className="border-t hairline">
        <div className="grid grid-cols-[1fr_140px_140px_120px_120px] px-6 py-3 border-b hairline">
          <p className="engraved">Recipient</p>
          <p className="engraved text-right">Amount</p>
          <p className="engraved">Requested</p>
          <p className="engraved">Keys</p>
          <p className="engraved text-right">Status</p>
        </div>
        {rest.map((t) => (
          <button
            key={t.id}
            onClick={() => onOpen(t.id)}
            className="w-full grid grid-cols-[1fr_140px_140px_120px_120px] px-6 py-4 border-b hairline text-left items-center hover:bg-secondary/60 transition-colors"
          >
            <div>
              <p className="text-sm text-ink">{t.recipientName}</p>
              <p className="mono text-xs text-ink-faint mt-0.5">
                {t.id} · {t.memo || "—"}
              </p>
            </div>
            <p className="mono text-sm text-ink text-right">
              {formatUSD(t.amount)}
            </p>
            <p className="text-xs text-ink-muted">{formatTime(t.requestedAt)}</p>
            <div className="flex items-center gap-1.5">
              {members.map((p) => (
                <KeyIcon key={p.id} filled={t.approvals.includes(p.id)} />
              ))}
              <span className="mono text-xs text-ink-muted ml-1">
                {t.approvals.length}/{QUORUM}
              </span>
            </div>
            <div className="text-right">
              <StatusPill status={t.status} />
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
