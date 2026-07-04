"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { rejectSchema, type RejectSchema } from "@/lib/schemas";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { InputStyles } from "@/components/shared/input-styles";
import { KeyArt } from "@/components/shared/key-art";
import { useVault } from "@/hooks/use-vault";
import { formatNGN } from "@/lib/format";
import type { Vault } from "@/lib/types";
import { Loader2 } from "lucide-react";

export function ApprovalDialog({
  vault,
  txId,
  onClose,
}: {
  vault: Vault;
  txId: string | null;
  onClose: () => void;
}) {
  const { state, turnKey, declineTx } = useVault();
  const tx = vault.transactions.find((t) => t.id === txId) ?? null;
  const current = state.currentPartner;
  const [turning, setTurning] = useState(false);
  const [done, setDone] = useState(false);
  const [declineMode, setDeclineMode] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RejectSchema>({
    resolver: zodResolver(rejectSchema),
    defaultValues: {
      reason: "",
    },
  });

  const open = !!tx;
  const reviewer = vault.stakeholders.find((s) => s.id === current);
  const requester = vault.stakeholders.find((s) => s.id === tx?.requestedBy);

  useEffect(() => {
    if (!open) {
      setTurning(false);
      setDone(false);
      setDeclineMode(false);
      reset();
    }
  }, [open, reset]);

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

  const onSubmitDecline = (data: RejectSchema) => {
    declineTx(tx.id, reviewer.id, data.reason.trim());
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
            {requester?.name} has requested a payout of
          </p>
          <p className="mono text-3xl text-ink">{formatNGN(tx.amountKobo)}</p>
          <p className="text-sm text-ink">
            to <span className="text-ink">{tx.recipientName}</span>
            <span className="mono text-ink-faint"> · {tx.recipientAccount}</span>
          </p>
          <p className="text-sm text-ink-muted">{tx.recipientBankName}</p>
          {tx.memo && <p className="text-sm text-ink-muted">Memo: {tx.memo}</p>}
        </div>

        <form onSubmit={handleSubmit(onSubmitDecline)}>
          {declineMode ? (
            <div className="px-6 pb-2">
              <Field label="Reason for declining">
                <input
                  autoFocus
                  className="input-mech"
                  placeholder="State why you are declining"
                  disabled={isSubmitting}
                  {...register("reason")}
                />
                {errors.reason && (
                  <p className="text-xs text-crimson mt-1">{errors.reason.message}</p>
                )}
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
                  type="button"
                  className="btn-mech btn-mech-ghost"
                  onClick={() => setDeclineMode(false)}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn-mech btn-mech-danger disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center min-w-[130px]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Confirm Decline"
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-mech btn-mech-danger"
                  onClick={() => setDeclineMode(true)}
                  disabled={turning || done}
                >
                  Decline
                </button>
                <button
                  type="button"
                  className="btn-mech btn-mech-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center min-w-[150px]"
                  onClick={handleTurn}
                  disabled={turning || done}
                >
                  {turning || done ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Turn Key to Approve"
                  )}
                </button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
