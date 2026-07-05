"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DetailRow } from "@/components/shared/detail-row";
import { KeyIcon } from "@/components/shared/key-icon";
import { Seal } from "@/components/shared/seal";
import { StatusPill } from "@/components/shared/status-pill";
// import { useVault } from "@/hooks/use-vault";
// TODO: Batch 4 - Replace with URL-based active vault stakeholder query state
import { formatTime, formatNGN } from "@/lib/format";
import type { Vault } from "@/lib/types";

export function TxDetailSheet({
  vault,
  txId,
  onClose,
  onApprove,
}: {
  vault: Vault;
  txId: string | null;
  onClose: () => void;
  onApprove: () => void;
}) {
  // const { state } = useVault();
  const state = { currentPartner: "" } as any;
  const tx = vault.transactions.find((t) => t.id === txId) ?? null;
  const current = state.currentPartner;
  const open = !!tx;
  const justSealed = tx?.status === "sealed";
  const settled = tx?.status === "settled";
  const canApprove =
    tx && tx.status === "pending" && !tx.approvals.includes(current);

  return (
    <Sheet open={open} onOpenChange={(b) => !b && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg bg-paper border-l hairline-strong p-0"
        style={{ borderRadius: 0 }}
      >
        {tx && (
          <>
            <SheetHeader className="px-6 py-5 border-b hairline text-left space-y-1">
              <div className="flex items-center justify-between">
                <SheetTitle className="serif text-xl text-ink font-normal">
                  Payout to {tx.recipientName}
                </SheetTitle>
                <StatusPill status={tx.status} />
              </div>
              <SheetDescription className="mono text-xs text-ink-faint">
                {tx.id} · Requested by{" "}
                {vault.stakeholders.find((s) => s.id === tx.requestedBy)?.name}{" "}
                · {formatTime(tx.requestedAt)}
              </SheetDescription>
            </SheetHeader>

            <div className="px-6 py-6 space-y-6 relative overflow-hidden">
              <div
                className={`seal-stamp absolute top-4 right-6 pointer-events-none ${
                  justSealed || settled ? "shown" : ""
                }`}
              >
                <Seal
                  quorum={tx.requiredQuorum}
                  total={vault.stakeholders.length}
                />
              </div>

              <DetailRow
                label="Amount"
                value={
                  <span className="mono text-2xl text-ink">
                    {formatNGN(tx.amountKobo)}
                  </span>
                }
              />
              <DetailRow
                label="Recipient"
                value={<span className="text-ink">{tx.recipientName}</span>}
              />
              <DetailRow
                label="Bank"
                value={<span className="text-ink">{tx.recipientBankName}</span>}
              />
              <DetailRow
                label="Account"
                value={
                  <span className="mono text-sm text-ink">
                    {tx.recipientAccount}
                  </span>
                }
              />
              <DetailRow
                label="Memo"
                value={<span className="text-ink">{tx.memo || "—"}</span>}
              />

              <div>
                <p className="engraved mb-3">Keys turned</p>
                <div className="border hairline-strong divide-y hairline">
                  {vault.stakeholders.map((p) => {
                    const turned = tx.approvals.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-7 h-7 border hairline-strong flex items-center justify-center mono text-[10px] text-ink"
                            style={{ borderRadius: 999 }}
                          >
                            {p.initials}
                          </div>
                          <p className="text-sm text-ink">{p.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <KeyIcon filled={turned} />
                          <p className="engraved">
                            {turned ? "Turned" : "Awaiting"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {settled && tx.settledAt && (
                <p className="text-sm text-ink-muted">
                  Payout sealed and sent. Funds settled{" "}
                  {formatTime(tx.settledAt)}.
                </p>
              )}
              {tx.status === "declined" && (
                <div className="border hairline-strong p-4 bg-card">
                  <p className="engraved text-crimson">Declined</p>
                  <p className="text-sm text-ink mt-1.5">
                    Declined by{" "}
                    {
                      vault.stakeholders.find((s) => s.id === tx.declinedBy)
                        ?.name
                    }
                    . No funds were moved.
                  </p>
                  {tx.declineReason && (
                    <p className="text-sm text-ink-muted mt-2 italic">
                      &quot;{tx.declineReason}&quot;
                    </p>
                  )}
                </div>
              )}
            </div>

            {canApprove && (
              <div className="px-6 py-4 border-t hairline bg-card flex items-center justify-between">
                <p className="text-xs text-ink-muted leading-tight max-w-[60%]">
                  This payout is awaiting your key.
                </p>
                <button
                  className="btn-mech btn-mech-primary"
                  onClick={onApprove}
                >
                  Review and Approve
                </button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
