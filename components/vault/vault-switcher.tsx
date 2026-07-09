"use client";

import { useRouter } from "next/navigation";
import type { Vault } from "@/lib/types";
// import { useVault } from "@/hooks/use-vault";
// TODO: Batch 4 - Replace with URL-based / React Query dynamic state logic

import { useVaultsQuery } from "@/hooks/use-vaults-query";

interface VaultSwitcherProps {
  vault: Vault;
  vaultId: string;
}

export function VaultSwitcher({ vault, vaultId }: VaultSwitcherProps) {
  const router = useRouter();
  const { data: vaultsData } = useVaultsQuery();

  const handleLeave = () => {
    router.push("/home");
  };

  const vaultsList = vaultsData?.vaults ?? [];

  return (
    <div className="relative inline-block text-left">
      <select
        value={vaultId}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "leave") {
            handleLeave();
          } else {
            router.push(`/vault/${val}`);
          }
        }}
        className="serif text-base sm:text-lg text-ink leading-none bg-transparent border-0 cursor-pointer focus:outline-none focus:ring-0 pr-6 appearance-none truncate max-w-[140px] sm:max-w-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%234F4F4F' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: 'right center',
          backgroundSize: '1.2em 1.2em',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <option key={vault.id} value={vault.id}>{vault.name}</option>
        {vaultsList
          .filter((v: { id: string; status?: string }) => v.id !== vault.id && v.status === "active")
          .map((v: { id: string; name: string }) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        <option value="leave">← Back to Home</option>
      </select>
    </div>
  );
}
