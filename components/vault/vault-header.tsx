"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useVault } from "@/hooks/use-vault";
import { formatNGN } from "@/lib/format";
import type { Vault } from "@/lib/types";
import IdentitySwitcher from "./identity-switcher";
import { VaultSwitcher } from "./vault-switcher";

export function VaultHeader({
  vault,
  onSettings,
}: {
  vault: Vault;
  onSettings: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { state, updateVaultFundingAccount, reloadVaults } = useVault();
  const current = state.currentPartner;

  // Determine if the current partner is the founder
  const isFounder = vault.stakeholders.find((s) => s.id === current)?.isFounder ?? false;

  const handleRetryVA = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/vaults/${vault.id}/fund`, {
        method: "POST",
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || "Failed to set up account. Try again.");
        return;
      }

      const { accountNumber, bankName } = await res.json();
      updateVaultFundingAccount(vault.id, accountNumber, bankName);
      // Optimistically reload the vaults data globally to keep lists synced
      await reloadVaults().catch(() => {});
      router.refresh();
      toast.success("Funding account set up successfully.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setRetrying(false);
    }
  };

  const pendingForMe = vault.transactions.filter(
    (t) => t.status === "pending" && !t.approvals.includes(current),
  ).length;

  const handleSignOut = () => {
    void signOut({ redirectTo: "/sign-in" });
  };

  return (
    <header className="border-b hairline-strong bg-paper">
      <div className="max-w-6xl mx-auto px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 border hairline-strong flex items-center justify-center"
            style={{ borderRadius: 2 }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
            >
              <rect
                x="4"
                y="4"
                width="16"
                height="16"
                stroke="var(--ink)"
                strokeWidth="1.5"
              />
              <circle
                cx="12"
                cy="12"
                r="3"
                stroke="var(--ink)"
                strokeWidth="1.5"
              />
              <path
                d="M12 12v4"
                stroke="var(--ink)"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <div>
            <VaultSwitcher vault={vault} />
            <p className="engraved mt-1">
              Partnership Vault · {vault.quorum} of {vault.stakeholders.length}{" "}
              quorum
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <IdentitySwitcher vault={vault} />
            {pendingForMe > 0 && (
              <span
                className="absolute -top-1 -right-1 w-2 h-2 bg-brass rounded-full"
                style={{ boxShadow: "0 0 0 2px var(--paper)" }}
                aria-label={`${pendingForMe} pending approval`}
              />
            )}
          </div>
          <button
            className="engraved text-ink-faint hover:text-ink transition-colors px-2 py-1"
            onClick={onSettings}
          >
            Settings
          </button>
          <button
            className="engraved text-ink-faint hover:text-ink transition-colors px-2 py-1"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-8 py-10 flex items-start justify-between gap-10">
        <div>
          <p className="engraved mb-3">Vault balance</p>
          <p
            className="serif text-5xl text-ink tracking-tight"
            style={{ fontVariantNumeric: "tabular-nums oldstyle-nums" }}
          >
            {formatNGN(vault.balanceKobo)}
          </p>
        </div>

        <div className="hairline mt-6 pt-6">
          <p className="engraved mb-2">Funding Account</p>
          {vault.fundingAccount ?
            <div className="flex items-center gap-3">
              <span
                className="serif text-3xl text-ink tracking-tight"
                style={{ fontVariantNumeric: "tabular-nums oldstyle-nums" }}
              >
                {vault.fundingAccount}
              </span>
              {vault.nombaVirtualAccountBank && (
                <span className="text-xs text-ink-faint">
                  ({vault.nombaVirtualAccountBank})
                </span>
              )}
              <button
                className="btn-mech btn-mech-ghost text-[10px] py-1 px-2 uppercase tracking-wider"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(vault.fundingAccount);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    // Ignore
                  }
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          : isFounder ? (
              <div>
                <p className="engraved text-ink-faint">
                  Account details unavailable.
                </p>
                <button
                  className="btn-mech btn-mech-ghost text-xs mt-2"
                  onClick={handleRetryVA}
                  disabled={retrying}
                >
                  {retrying ? "Retrying..." : "Retry account setup"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-ink-faint">Account details pending...</p>
            )
          }
        </div>
      </div>
    </header>
  );
}
