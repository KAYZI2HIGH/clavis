import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import type { Vault } from "@/lib/types";
// import { useVault } from "@/hooks/use-vault";
// TODO: Batch 4 - Replace with URL-based React Query query invalidation

export function useApproveMutation(vaultId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ txId }: { txId: string }) => {
      const res = await fetch(
        `/api/vaults/${vaultId}/transactions/${txId}/approve`,
        { method: "POST" }
      );
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to approve");
      }
      return res.json();
    },
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: queryKeys.vaults.detail(vaultId) });
      const previousData = qc.getQueryData(queryKeys.vaults.detail(vaultId));
      
      const vault = previousData as Vault | undefined;
      if (vault) {
        qc.setQueryData(
          queryKeys.vaults.detail(vaultId),
          (old: Vault | undefined) => {
            if (!old) return old;
            return {
              ...old,
              transactions: old.transactions.map((t) =>
                t.id === variables.txId
                  ? {
                      ...t,
                      approvals: [...(t.approvals ?? []), old.youId],
                    }
                  : t
              ),
            };
          }
        );
      }
      return { previousData };
    },
    onError: (error: Error, variables, context) => {
      if (context?.previousData) {
        qc.setQueryData(queryKeys.vaults.detail(vaultId), context.previousData);
      }
      toast.error(error.message);
    },
    onSuccess: (data) => {
      toast.success("Key turned. Approval recorded.");
      if (data?.quorumReached) {
        toast.success("Quorum reached. Payout is being processed.", {
          duration: 6000,
        });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ 
        queryKey: queryKeys.vaults.detail(vaultId) 
      });
    },
  });
}
