"use client";

import { useState } from "react";
import { useMembers } from "@/hooks/use-member";
import { useVault } from "@/hooks/use-vault";

export default function IdentitySwitcher() {
  const members = useMembers();
  const { state, setActor } = useVault();
  const current = state.currentPartner;
  const [open, setOpen] = useState(false);
  const me = members.find((m) => m.id === current);

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
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          className="text-ink-faint"
        >
          <path
            d="M2 4l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
          />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-20 bg-paper border hairline-strong min-w-[240px] shadow-sm"
            style={{ borderRadius: 2 }}
          >
            <div className="px-3 py-2 border-b hairline">
              <p className="engraved">Switch partner</p>
            </div>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setActor(m.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/60 text-left transition-colors"
              >
                <div
                  className="w-7 h-7 border hairline-strong bg-card flex items-center justify-center mono text-[10px] text-ink"
                  style={{ borderRadius: 999 }}
                >
                  {m.initials}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-ink">{m.name}</p>
                  <p className="engraved text-ink-faint">{m.phone}</p>
                </div>
                {m.id === current && (
                  <span className="engraved text-brass-deep">Current</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
