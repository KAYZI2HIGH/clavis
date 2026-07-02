"use client";

import { useEffect, useState } from "react";
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
  const [recipientName, setName] = useState("");
  const [recipientAccount, setAccount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [amountStr, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setAccount("");
      setBankCode("");
      setAmount("");
      setMemo("");
    }
  }, [open]);

  const amountKobo = Math.round(parseFloat(amountStr || "0") * 100);
  const valid =
    recipientName.trim() &&
    recipientAccount.trim() &&
    bankCode &&
    amountKobo > 0 &&
    amountKobo <= vault.balanceKobo;

  const submit = () => {
    if (!valid) return;
    requestPayout({
      recipientName: recipientName.trim(),
      recipientAccount: recipientAccount.trim(),
      recipientBankCode: bankCode,
      recipientBankName: getBankName(bankCode),
      amountKobo,
      memo: memo.trim(),
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

        <div className="px-6 py-6 space-y-5">
          <Field label="Recipient name">
            <input
              autoFocus
              className="input-mech"
              value={recipientName}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vendor LLC"
            />
          </Field>
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
              value={recipientAccount}
              onChange={(e) =>
                setAccount(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              inputMode="numeric"
              placeholder="0123456789"
            />
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
                value={amountStr}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="0.00"
                style={{ borderLeft: 0 }}
              />
            </div>
            {amountKobo > vault.balanceKobo && (
              <p className="text-xs text-crimson mt-1.5">
                Amount exceeds vault balance.
              </p>
            )}
          </Field>
          <Field label="Memo" hint="Optional">
            <input
              className="input-mech"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Q4 retainer"
            />
          </Field>
        </div>

        <div className="px-6 py-4 border-t hairline flex items-center justify-between bg-card">
          <button
            className="btn-mech btn-mech-ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={submit}
            className="btn-mech btn-mech-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Request Payout
          </button>
        </div>
        <InputStyles />
      </SheetContent>
    </Sheet>
  );
}
