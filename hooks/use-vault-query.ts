import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { Vault } from "@/lib/types";

export function useVaultQuery(vaultId: string | null) {
  return useQuery({
    queryKey: queryKeys.vaults.detail(vaultId ?? ""),
    queryFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}`);
      if (!res.ok) throw new Error("Failed to fetch vault");
      return res.json() as Promise<Vault>;
    },
    enabled: !!vaultId,
  });
}
