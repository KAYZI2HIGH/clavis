"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { InputStyles } from "@/components/shared/input-styles";
import { KeyArt } from "@/components/shared/key-art";
import { usePartnerById } from "@/hooks/use-member";
import { useVault } from "@/hooks/use-vault";
import { formatUSD } from "@/lib/format";

export function ApprovalDialog({
  txId,
  onClose,
}: {
  txId: string | null;
  onClose: () => void;
}) {
  const { state, turnKey, declineTx } = useVault();
  const tx = state.transactions.find((t) => t.id === txId) ?? null;
  const current = state.currentPartner;
  const partnerById = usePartnerById();
  const [turning, setTurning] = useState(false);
  const [done, setDone] = useState(false);
  const [declineMode, setDeclineMode] = useState(false);
  const [reason, setReason] = useState("");

  const open = !!tx;
  const reviewer = partnerById(current);

  useEffect(() => {
    if (!open) {
      setTurning(false);
      setDone(false);
      setDeclineMode(false);
      setReason("");
    }
  }, [open]);

  if (!tx || !reviewer) return null;

  const handleTurn = () => {
    if (turning || done) return;
    setTurning(true);
    setTimeout(() => {
      turnKey(tx.id, reviewer.id);
      setDone(true);
      setTimeout(onClose, 1100);
    }, 900);
  };

  const handleDecline = () => {
    if (!reason.trim()) return;
    declineTx(tx.id, reviewer.id, reason.trim());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(b) => !b && !turning && onClose()}>
      <DialogContent
        className="bg-paper border hairline-strong sm:max-w-md p-0"
        style={{ borderRadius: 3 }}
      >
        <div className="px-6 py-5 border-b hairline">
          <p className="engraved">
            Approval required · acting as {reviewer.initials}
          </p>
          <h3 className="serif text-xl text-ink mt-1 font-normal">
            {declineMode ? "Decline this payout" : "Turn Key to Approve"}
          </h3>
        </div>

        <div className="px-6 py-5 space-y-1">
          <p className="text-sm text-ink-muted">
            {partnerById(tx.requestedBy)?.name} has requested a payout of
          </p>
          <p className="mono text-3xl text-ink">{formatUSD(tx.amount)}</p>
          <p className="text-sm text-ink">
            to <span className="text-ink">{tx.recipientName}</span>
            <span className="mono text-ink-faint">
              {" "}
              · {tx.recipientAccount}
            </span>
          </p>
          {tx.memo && <p className="text-sm text-ink-muted">Memo: {tx.memo}</p>}
        </div>

        {declineMode ? (
          <div className="px-6 pb-2">
            <Field label="Reason for declining">
              <input
                autoFocus
                className="input-mech"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State why you are declining"
              />
            </Field>
            <InputStyles />
          </div>
        ) : (
          <div className="px-6 pb-6 flex flex-col items-center">
            <div className="key-slot my-4">
              <div className="key-slot-hole" />
              <div className={`key ${turning || done ? "turned" : ""}`}>
                <KeyArt />
              </div>
            </div>
            <p className="engraved mt-1">
              {done
                ? "Quorum met. Payout sealed."
                : turning
                  ? "Turning…"
                  : "Hold the key. Turn to approve."}
            </p>
          </div>
        )}

        <div className="px-6 py-4 border-t hairline flex items-center justify-between bg-card">
          {declineMode ? (
            <>
              <button
                className="btn-mech btn-mech-ghost"
                onClick={() => setDeclineMode(false)}
              >
                Back
              </button>
              <button
                className="btn-mech btn-mech-danger disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleDecline}
                disabled={!reason.trim()}
              >
                Confirm Decline
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-mech btn-mech-danger"
                onClick={() => setDeclineMode(true)}
                disabled={turning || done}
              >
                Decline
              </button>
              <button
                className="btn-mech btn-mech-primary disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleTurn}
                disabled={turning || done}
              >
                {done ? "Sealed" : "Turn Key to Approve"}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
