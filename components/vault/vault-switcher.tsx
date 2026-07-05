"use client";

import { useRouter } from "next/navigation";
import type { Vault } from "@/lib/types";
// import { useVault } from "@/hooks/use-vault";
// TODO: Batch 4 - Replace with URL-based / React Query dynamic state logic

export function VaultSwitcher({ vault }: { vault: Vault }) {
  // const { leaveVault } = useVault();
  const leaveVault = (() => {}) as any;
  const router = useRouter();

  const handleLeave = () => {
    leaveVault();
    router.push("/home");
  };

  return (
    <button
      onClick={handleLeave}
      className="flex items-center gap-2 hover:bg-secondary/60 px-2 py-1 -mx-2 -my-1 transition-colors"
      style={{ borderRadius: 2 }}
      title="Switch vault"
    >
      <p className="serif text-lg text-ink leading-none">{vault.name}</p>
      <svg width="10" height="10" viewBox="0 0 12 12" className="text-ink-faint">
        <path
          d="M2 4l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
        />
      </svg>
    </button>
  );
}
