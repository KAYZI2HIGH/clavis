"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useMembers } from "@/hooks/use-member";
import { useVault } from "@/hooks/use-vault";
import { formatUSD } from "@/lib/format";
import { QUORUM } from "@/lib/mock-data";
import IdentitySwitcher from "./identity-switcher";

export function VaultHeader({ onSettings }: { onSettings: () => void }) {
  const { state } = useVault();
  const { signOut } = useAuth();
  const router = useRouter();
  const members = useMembers();
  const { balanceCents, transactions, currentPartner } = state;

  const pendingForMe = transactions.filter(
    (t) => t.status === "pending" && !t.approvals.includes(currentPartner),
  ).length;

  const handleSignOut = () => {
    signOut();
    router.push("/");
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
            <p className="serif text-lg text-ink leading-none">
              Halverson, Ortega &amp; Reeve
            </p>
            <p className="engraved mt-1">
              Partnership Vault · {QUORUM} of {members.length} quorum
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <IdentitySwitcher />
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
          {formatUSD(balanceCents)}
        </p>
      </div>
    </header>
  );
}
