"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { makeId } from "@/lib/vault-utils";
import { rejectSchema, type RejectSchema } from "@/lib/schemas";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { InputStyles } from "@/components/shared/input-styles";
import { KeyArt } from "@/components/shared/key-art";
import { formatNGN } from "@/lib/format";
import type { Vault } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApproveMutation } from "@/hooks/use-approve-mutation";
import { useRejectMutation } from "@/hooks/use-reject-mutation";

interface ApprovalDialogProps {
  vault: Vault;
  vaultId: string;
  txId: string | null;
  onClose: () => void;
}

export function ApprovalDialog({
  vault,
  vaultId,
  txId,
  onClose,
}: ApprovalDialogProps) {
  const qc = useQueryClient();
  const approveMutation = useApproveMutation(vaultId);
  const rejectMutation = useRejectMutation(vaultId);

  const tx = vault.transactions.find((t) => t.id === txId) ?? null;
  const current = vault.youId;
  const [turning, setTurning] = useState(false);
  const [done, setDone] = useState(false);
  const [declineMode, setDeclineMode] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
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

  const userHasApproved = tx.approvals.includes(current);
  const alreadyProcessed = tx.status === "executing" || tx.status === "settled";

  const handleTurn = async () => {
    if (turning || done) return;
    setTurning(true);

    const previousData = qc.getQueryData(queryKeys.vaults.detail(vaultId));

    // Optimistic Approval insertion
    qc.setQueryData(
      queryKeys.vaults.detail(vaultId),
      (old: Vault | undefined) => {
        if (!old) return old;
        return {
          ...old,
          transactions: old.transactions.map((t) =>
            t.id === txId
              ? {
                  ...t,
                  approvals: [...t.approvals, current],
                }
              : t
          ),
        };
      }
    );

    try {
      await approveMutation.mutateAsync({ txId: tx.id });
      setDone(true);
      setTimeout(onClose, 1100);
    } catch {
      qc.setQueryData(queryKeys.vaults.detail(vaultId), previousData);
      setTurning(false);
      toast.error("Failed to record approval. Try again.");
    }
  };

  const onSubmitDecline = async (data: RejectSchema) => {
    const previousData = qc.getQueryData(queryKeys.vaults.detail(vaultId));

    // Optimistic Decline status update
    qc.setQueryData(
      queryKeys.vaults.detail(vaultId),
      (old: Vault | undefined) => {
        if (!old) return old;
        return {
          ...old,
          transactions: old.transactions.map((t) =>
            t.id === txId
              ? { ...t, status: "declined" as const }
              : t
          ),
        };
      }
    );

    try {
      await rejectMutation.mutateAsync({
        txId: tx.id,
        reason: data.reason.trim(),
      });
      onClose();
    } catch {
      qc.setQueryData(queryKeys.vaults.detail(vaultId), previousData);
    }
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
                  disabled={rejectMutation.isPending}
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
              {userHasApproved ? (
                <p className="text-sm text-ink-muted my-6">You have already approved this payout</p>
              ) : alreadyProcessed ? (
                <p className="text-sm text-ink-muted my-6">This payout is already being processed</p>
              ) : tx.status === "declined" ? (
                <p className="text-sm text-ink-muted my-6">This payout was declined</p>
              ) : (
                <>
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
                </>
              )}
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
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? (
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
                  disabled={turning || done || approveMutation.isPending || userHasApproved || alreadyProcessed}
                >
                  Decline
                </button>
                <button
                  type="button"
                  className="btn-mech btn-mech-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center min-w-[150px]"
                  onClick={handleTurn}
                  disabled={turning || done || approveMutation.isPending || userHasApproved || alreadyProcessed}
                >
                  {turning || done || approveMutation.isPending ? (
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
