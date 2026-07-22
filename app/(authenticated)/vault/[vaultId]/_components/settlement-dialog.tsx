"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatNGN } from "@/lib/format";
import type { Vault } from "@/lib/types";

interface SettlementDialogProps {
  vault: Vault;
  vaultId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettlementDialog({
  vault,
  vaultId,
  open,
  onOpenChange,
}: SettlementDialogProps) {
  const qc = useQueryClient();
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");

  const { data: settlementPreview, isLoading } = useQuery({
    queryKey: ["vault", vaultId, "settlement-preview"],
    queryFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}/settlement/preview`);
      if (!res.ok) throw new Error("Failed to fetch settlement preview");
      return res.json();
    },
    enabled: open,
  });

  const runSettlementMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}/settlement/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber, bankCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run settlement");
      return data;
    },
    onSuccess: () => {
      alert("Settlement run successfully!");
      qc.invalidateQueries({ queryKey: ["vault", vaultId] });
      qc.invalidateQueries({
        queryKey: ["vault", vaultId, "settlement-preview"],
      });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-paper border hairline-strong sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="serif text-xl font-normal text-ink">
            Run Settlement
          </DialogTitle>
          <DialogDescription className="text-ink-muted">
            Review the current revenue and expenses, then disburse your profit share.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <p className="text-sm text-ink-muted">Loading preview...</p>
          ) : settlementPreview ? (
            <div>
              <p className="text-sm font-medium mb-3 text-ink">
                Settlement in {settlementPreview.days_remaining} days
              </p>
              <div className="space-y-2 mb-4 text-sm text-ink">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Revenue:</span>
                  <span className="mono">
                    {formatNGN(settlementPreview.total_revenue_kobo)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Expenses:</span>
                  <span className="mono">
                    {formatNGN(settlementPreview.total_expenses_kobo)}
                  </span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t hairline">
                  <span className="text-ink-muted">Profit Pool:</span>
                  <span className="mono">
                    {formatNGN(settlementPreview.profit_pool_kobo)}
                  </span>
                </div>
              </div>

              <div className="bg-card border hairline p-4 mb-5">
                <div className="flex justify-between font-medium text-brass-deep">
                  <span>
                    Your share ({settlementPreview.investor_share_percent}%):
                  </span>
                  <span className="mono text-lg">
                    {formatNGN(settlementPreview.investor_share_kobo)}
                  </span>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <label className="text-xs text-ink-muted block mb-1">
                    Destination Account
                  </label>
                  <input
                    placeholder="0123456789"
                    className="input-mech w-full mono"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-ink-muted block mb-1">
                    Bank Code
                  </label>
                  <input
                    placeholder="e.g. 058"
                    className="input-mech w-full mono"
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                  />
                </div>
              </div>

              <button
                className="btn-mech btn-mech-primary w-full"
                onClick={() => runSettlementMutation.mutate()}
                disabled={
                  runSettlementMutation.isPending || !accountNumber || !bankCode
                }
              >
                {runSettlementMutation.isPending
                  ? "Processing..."
                  : "Execute Payout"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-crimson">Failed to load preview.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
