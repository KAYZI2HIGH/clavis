import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { Vault } from "@/lib/types";

export function useVaultQuery(vaultId: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: queryKeys.vaults.detail(vaultId),
    queryFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}`);
      if (!res.ok) throw new Error("Failed to fetch vault");
      const { vault } = await res.json();
      return vault as Vault;
    },
    enabled: !!vaultId,
    staleTime: options?.refetchInterval ? 0 : 1000 * 30,
    refetchInterval: options?.refetchInterval,
  });
}
