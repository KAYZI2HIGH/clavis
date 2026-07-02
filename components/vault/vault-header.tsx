"use client";

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
  const { state } = useVault();
  const current = state.currentPartner;

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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect
                x="4"
                y="4"
                width="16"
                height="16"
                stroke="var(--ink)"
                strokeWidth="1.5"
              />
              <circle cx="12" cy="12" r="3" stroke="var(--ink)" strokeWidth="1.5" />
              <path d="M12 12v4" stroke="var(--ink)" strokeWidth="1.5" />
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
      <div className="max-w-6xl mx-auto px-8 py-10">
        <p className="engraved mb-3">Vault balance</p>
        <p
          className="serif text-5xl text-ink tracking-tight"
          style={{ fontVariantNumeric: "tabular-nums oldstyle-nums" }}
        >
          {formatNGN(vault.balanceKobo)}
        </p>
      </div>
    </header>
  );
}
