"use client";

import { useState } from "react";
import type { Vault } from "@/lib/types";
import { useVault } from "@/hooks/use-vault";

export default function Profile({ vault }: { vault: Vault }) {
  const { state, setActor } = useVault();
  const current = state.currentPartner;
  const [open, setOpen] = useState(false);
  const me = vault.stakeholders.find((m) => m.id === current);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((b) => !b)}
        className="flex items-center gap-2 px-2 py-1.5 border hairline hover:hairline-strong transition-colors bg-card"
        style={{ borderRadius: 2 }}
      >
        <span className="engraved text-ink-faint">Viewing as</span>
        <div
          className="w-6 h-6 border hairline-strong bg-paper flex items-center justify-center mono text-[10px] text-ink"
          style={{ borderRadius: 999 }}
        >
          {me?.initials}
        </div>
        <span className="text-sm text-ink">{me?.name}</span>
      </button>
    </div>
  );
}
