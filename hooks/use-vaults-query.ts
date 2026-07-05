import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { Vault } from "@/lib/types";

export function useVaultsQuery() {
  return useQuery({
    queryKey: queryKeys.vaults.all,
    queryFn: async () => {
      const res = await fetch("/api/vaults");
      if (!res.ok) throw new Error("Failed to fetch vaults");
      const { vaults } = await res.json();
      return { vaults } as { vaults: Vault[] };
    },
    staleTime: 1000 * 30,
  });
}
