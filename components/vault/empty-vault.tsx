"use client";

import type { Vault } from "@/lib/types";
import { useVault } from "@/hooks/use-vault";

export function EmptyVault({ vault }: { vault: Vault }) {
  const { fundVault } = useVault();

  return (
    <div className="max-w-3xl mx-auto pt-20 pb-16">
      <p className="engraved mb-6">Vault status</p>
      <h2 className="serif text-3xl tracking-tight text-ink leading-snug max-w-xl">
        Fund the vault to begin. No payout can move until partners turn their
        keys.
      </h2>

      <div className="mt-12 border hairline-strong bg-card">
        <div className="px-6 py-4 border-b hairline flex items-center justify-between">
          <p className="engraved">Funding account</p>
          <p className="engraved text-ink-faint">Wire or ACH</p>
        </div>
        <div className="px-6 py-8">
          <p className="mono text-2xl text-ink tracking-wider">
            {vault.fundingAccount}
          </p>
          <p className="text-sm text-ink-muted mt-3 max-w-md">
            Send deposits to this account. Funds appear in the vault once
            cleared. Outbound transfers require {vault.quorum} of{" "}
            {vault.stakeholders.length} partner keys.
          </p>
        </div>
        <div className="px-6 py-3 border-t hairline flex items-center justify-between">
          <p className="engraved text-ink-faint">Routing 028-441-991</p>
          <button className="btn-mech btn-mech-ghost" onClick={fundVault}>
            Simulate incoming deposit
          </button>
        </div>
      </div>
    </div>
  );
}
