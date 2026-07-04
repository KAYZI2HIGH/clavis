"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPayoutSchema, type RequestPayoutSchema } from "@/lib/schemas";
import { useRecipientLookupQuery } from "@/hooks/use-recipient-lookup-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Field } from "@/components/shared/field";
import { InputStyles } from "@/components/shared/input-styles";
import { useVault } from "@/hooks/use-vault";
import { formatNGN } from "@/lib/format";
import { getBankName, NIGERIAN_BANKS } from "@/lib/nigerian-banks";
import type { Vault } from "@/lib/types";
import { Loader2 } from "lucide-react";

export function RequestPayoutSheet({
  vault,
  open,
  onOpenChange,
}: {
  vault: Vault;
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const { requestPayout } = useVault();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
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
    amountKobo <= vault.balanceKobo;

  const onSubmit = (data: RequestPayoutSchema) => {
    if (!valid || !resolvedAccountName) return;
    requestPayout({
      recipientName: resolvedAccountName,
      recipientAccount: data.recipientAccount,
      recipientBankCode: data.recipientBankCode,
      recipientBankName: getBankName(data.recipientBankCode),
      amountKobo,
      memo: (data.memo ?? "").trim(),
    });
    onOpenChange(false);
  };

  const moreKeys = vault.quorum - 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-paper border-l hairline-strong p-0"
        style={{ borderRadius: 0 }}
      >
        <SheetHeader className="px-6 py-5 border-b hairline space-y-1 text-left">
          <SheetTitle className="serif text-xl text-ink font-normal">
            Request Payout
          </SheetTitle>
          <SheetDescription className="text-sm text-ink-muted">
            Your key counts as the first approval. {moreKeys} more partner
            {moreKeys === 1 ? "" : "s"} must turn their key before funds move.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-6 py-6 space-y-5">
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
            </Field>

            <Field label="Recipient name">
              <div className="min-h-[38px] border hairline-strong bg-secondary/30 px-3 flex items-center text-sm">
                {lookupLoading ? (
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Verifying account details...</span>
                  </div>
                ) : resolvedAccountName ? (
                  <span className="text-ink font-medium tracking-wide">{resolvedAccountName}</span>
                ) : (
                  <span className="text-ink-faint italic">Enter account and select bank</span>
                )}
              </div>
            </Field>

            <Field
              label="Amount"
              hint={`Available ${formatNGN(vault.balanceKobo)}`}
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
              {amountKobo > vault.balanceKobo && (
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

          <div className="px-6 py-4 border-t hairline flex items-center justify-between bg-card">
            <button
              type="button"
              className="btn-mech btn-mech-ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid || isSubmitting}
              className="btn-mech btn-mech-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center min-w-[130px]"
            >
              {isSubmitting ? (
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
