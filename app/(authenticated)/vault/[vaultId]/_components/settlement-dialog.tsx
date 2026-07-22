"use client";

import { useState, useEffect } from "react";
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
import { useRecipientLookupQuery } from "@/hooks/use-recipient-lookup-query";
import { NIGERIAN_BANKS } from "@/lib/nigerian-banks";
import { Loader2 } from "lucide-react";
import { Field } from "@/components/shared/field";
import { InputStyles } from "@/components/shared/input-styles";

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

  const { data: lookupData, isLoading: lookupLoading } = useRecipientLookupQuery(
    accountNumber || "",
    bankCode || "",
  );

  const resolvedAccountName = lookupData?.accountName;

  useEffect(() => {
    if (!open) {
      setAccountNumber("");
      setBankCode("");
    }
  }, [open]);

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

  const valid = resolvedAccountName && accountNumber.length === 10 && bankCode;

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

              <div className="space-y-4 mb-6">
                <Field label="Bank">
                  <select
                    className="input-mech"
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                  >
                    <option value="">Select a bank</option>
                    {NIGERIAN_BANKS.map((bank) => (
                      <option key={bank.code} value={bank.code}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Account number">
                  <input
                    className="input-mech mono"
                    inputMode="numeric"
                    placeholder="0123456789"
                    value={accountNumber}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setAccountNumber(clean);
                    }}
                  />
                  {lookupLoading && (
                    <div className="flex items-center gap-1.5 text-ink-muted mt-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs">Verifying account...</span>
                    </div>
                  )}
                  {resolvedAccountName && !lookupLoading && (
                    <p className="text-xs text-ink-muted mt-1.5">
                      Recipient:{" "}
                      <span className="text-ink font-medium">
                        {resolvedAccountName}
                      </span>
                    </p>
                  )}
                </Field>
              </div>

              <button
                className="btn-mech btn-mech-primary w-full disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                onClick={() => runSettlementMutation.mutate()}
                disabled={
                  runSettlementMutation.isPending || !valid
                }
              >
                {runSettlementMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Execute Payout"
                )}
              </button>
            </div>
          ) : (
            <p className="text-sm text-crimson">Failed to load preview.</p>
          )}
        </div>
        <InputStyles />
      </DialogContent>
    </Dialog>
  );
}
