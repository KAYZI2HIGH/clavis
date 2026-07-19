import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
// import { useVault } from "@/hooks/use-vault";
// TODO: Batch 4 - Replace with URL-based React Query query invalidation

import type { Vault } from "@/lib/types";

export function useRejectMutation(vaultId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      txId, 
      reason 
    }: { 
      txId: string; 
      reason: string 
    }) => {
      const res = await fetch(
        `/api/vaults/${vaultId}/transactions/${txId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to reject");
      }
      return res.json();
    },
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: queryKeys.vaults.detail(vaultId) });
      const previousData = qc.getQueryData(queryKeys.vaults.detail(vaultId));
      qc.setQueryData(
        queryKeys.vaults.detail(vaultId),
        (old: Vault | undefined) => {
          if (!old) return old;
          return {
            ...old,
            transactions: (old.transactions ?? []).map((t) =>
              t.id === variables.txId
                ? { ...t, status: "declined" as const }
                : t
            ),
          };
        }
      );
      return { previousData };
    },
    onError: (error: Error, variables, context) => {
      if (context?.previousData) {
        qc.setQueryData(queryKeys.vaults.detail(vaultId), context.previousData);
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Payout declined.");
    },
    onSettled: () => {
      qc.invalidateQueries({ 
        queryKey: queryKeys.vaults.detail(vaultId) 
      });
    },
  });
}
