"use client";

import { useState } from "react";
import type { Vault } from "@/lib/types";
// import { useVault } from "@/hooks/use-vault";
// TODO: Batch 4 - Replace with URL-based active stakeholder state selection

export default function Profile({ vault }: { vault: Vault }) {
  const [open, setOpen] = useState(false);
  const me = (vault.stakeholders ?? []).find((m) => m.id === vault.youId) || (vault.stakeholders ?? [])[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((b) => !b)}
        className="flex items-center gap-2 px-2 py-1.5 border hairline hover:hairline-strong transition-colors bg-card"
        style={{ borderRadius: 2 }}
      >
        <span className="engraved text-ink-faint hidden sm:inline">Viewing as</span>
        <div
          className="w-6 h-6 border hairline-strong bg-paper flex items-center justify-center mono text-[10px] text-ink"
          style={{ borderRadius: 999 }}
        >
          {me?.initials}
        </div>
        <span className="text-sm text-ink hidden sm:inline">{me?.name}</span>
      </button>
    </div>
  );
}
