import { useQuery } from "@tanstack/react-query";

export function useReconciliationQuery(vaultId: string | null) {
  return useQuery({
    queryKey: ["reconciliation", vaultId],
    queryFn: async () => {
      const res = await fetch(
        `/api/vaults/${vaultId}/reconciliation`
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!vaultId,
    staleTime: 1000 * 60 * 5,
  });
}
