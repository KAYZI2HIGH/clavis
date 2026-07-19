"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { makeId } from "@/lib/vault-utils";
import { requestPayoutSchema, type RequestPayoutSchema } from "@/lib/schemas";
import { useRecipientLookupQuery } from "@/hooks/use-recipient-lookup-query";
import { useRequestPayoutMutation } from "@/hooks/use-request-payout-mutation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Field } from "@/components/shared/field";
import { InputStyles } from "@/components/shared/input-styles";
import { formatNGN } from "@/lib/format";
import { getBankName, NIGERIAN_BANKS } from "@/lib/nigerian-banks";
import type { Vault } from "@/lib/types";
import { Loader2 } from "lucide-react";

interface RequestPayoutSheetProps {
  vault: Vault;
  vaultId: string;
  open: boolean;
  onOpenChange: (b: boolean) => void;
}

export function RequestPayoutSheet({
  vault,
  vaultId,
  open,
  onOpenChange,
}: RequestPayoutSheetProps) {
  const qc = useQueryClient();
  const requestPayoutMutation = useRequestPayoutMutation(vaultId);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<RequestPayoutSchema>({
    resolver: zodResolver(requestPayoutSchema),
    defaultValues: {
      recipientAccount: "",
      recipientBankCode: "",
      amount: undefined as any,
      memo: "",
    },
  });

  const recipientAccount = watch("recipientAccount");
  const recipientBankCode = watch("recipientBankCode");
  const amountVal = watch("amount");

  const { data: lookupData, isLoading: lookupLoading } = useRecipientLookupQuery(
    recipientAccount || "",
    recipientBankCode || "",
  );

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const amountKobo = Math.round((Number(amountVal) || 0) * 100);
  const resolvedAccountName = lookupData?.accountName;

  const valid =
    resolvedAccountName &&
    recipientAccount?.length === 10 &&
    recipientBankCode &&
    amountKobo > 0 &&
    amountKobo <= vault.balance_kobo;

  const onSubmit = async (data: RequestPayoutSchema) => {
    if (!valid || !resolvedAccountName) return;

    // Optimistic Payout Request insertion
    const optimisticTx = {
      id: makeId("tx"),
      vault_id: vaultId,
      recipient_name: resolvedAccountName,
      recipient_account: data.recipientAccount,
      recipient_bank_code: data.recipientBankCode,
      amount_kobo: amountKobo,
      memo: (data.memo ?? "").trim(),
      status: "pending" as const,
      requested_by: vault.youId ?? "",
      requested_at: new Date().toISOString(),
      required_quorum: vault.quorum,
      approvals: [vault.youId ?? ""],
    };

    qc.setQueryData(
      queryKeys.vaults.detail(vaultId),
      (old: Vault | undefined) => {
        if (!old) return old;
        return {
          ...old,
          transactions: [optimisticTx, ...(old.transactions ?? [])],
        };
      }
    );

    try {
      await requestPayoutMutation.mutateAsync({
        recipientName: resolvedAccountName,
        recipientAccount: data.recipientAccount,
        recipientBankCode: data.recipientBankCode,
        recipientBankName: getBankName(data.recipientBankCode),
        amountKobo,
        memo: (data.memo ?? "").trim(),
      });
      onOpenChange(false);
    } catch {
      qc.invalidateQueries({ 
        queryKey: queryKeys.vaults.detail(vaultId) 
      });
    }
  };

  const moreKeys = vault.quorum - 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full! sm:max-w-md bg-paper border-l hairline-strong p-0 flex flex-col"
        style={{ borderRadius: 0 }}
      >
        <SheetHeader className="px-4 sm:px-6 py-5 border-b hairline space-y-1 text-left shrink-0">
          <SheetTitle className="serif text-xl text-ink font-normal">
            Request Payout
          </SheetTitle>
          <SheetDescription className="text-sm text-ink-muted">
            Your key counts as the first approval. {moreKeys} more partner
            {moreKeys === 1 ? "" : "s"} must turn their key before funds move.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
          <ScrollArea className="flex-1 px-4 sm:px-6 py-6">
            <div className="space-y-5">
            <Field label="Bank">
              <select
                className="input-mech"
                {...register("recipientBankCode")}
              >
                <option value="">Select a bank</option>
                {NIGERIAN_BANKS.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </select>
              {errors.recipientBankCode && (
                <p className="text-xs text-crimson mt-1">{errors.recipientBankCode.message}</p>
              )}
            </Field>

            <Field label="Account number">
              <input
                className="input-mech mono"
                inputMode="numeric"
                placeholder="0123456789"
                {...register("recipientAccount", {
                  onChange: (e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setValue("recipientAccount", clean);
                  }
                })}
              />
              {errors.recipientAccount && (
                <p className="text-xs text-crimson mt-1">{errors.recipientAccount.message}</p>
              )}
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

            <Field
              label="Amount"
              hint={`Available ${formatNGN(vault.balance_kobo)}`}
            >
              <div className="flex items-center">
                <span className="mono text-ink-faint px-3 border hairline-strong border-r-0 h-[38px] flex items-center">
                  ₦
                </span>
                <input
                  inputMode="decimal"
                  className="input-mech mono"
                  placeholder="0.00"
                  style={{ borderLeft: 0 }}
                  {...register("amount", {
                    valueAsNumber: true,
                    onChange: (e) => {
                      const clean = e.target.value.replace(/[^0-9.]/g, "");
                      setValue("amount", clean ? parseFloat(clean) : undefined as any);
                    }
                  })}
                />
              </div>
              {errors.amount && (
                <p className="text-xs text-crimson mt-1">{errors.amount.message}</p>
              )}
              {amountKobo > vault.balance_kobo && (
                <p className="text-xs text-crimson mt-1.5">
                  Amount exceeds vault balance.
                </p>
              )}
            </Field>
            <Field label="Memo" hint="Optional">
              <input
                className="input-mech"
                placeholder="Q4 retainer"
                {...register("memo")}
              />
              {errors.memo && (
                <p className="text-xs text-crimson mt-1">{errors.memo.message}</p>
              )}
            </Field>
          </div>
          </ScrollArea>

          <div className="px-4 sm:px-6 py-4 border-t hairline flex items-center justify-between bg-card shrink-0">
            <button
              type="button"
              className="btn-mech btn-mech-ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid || requestPayoutMutation.isPending}
              className="btn-mech btn-mech-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center min-w-[130px]"
            >
              {requestPayoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Request Payout"
              )}
            </button>
          </div>
        </form>
        <InputStyles />
      </SheetContent>
    </Sheet>
  );
}
