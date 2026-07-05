import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
// import { useVault } from "@/hooks/use-vault";
// TODO: Batch 4 - Replace with URL-based React Query query invalidation

export function useApproveMutation(vaultId: string) {
  const qc = useQueryClient();
  // const { reloadVaults } = useVault();
  const reloadVaults = (() => {}) as any;
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
    onSuccess: (data) => {
      qc.invalidateQueries({ 
        queryKey: queryKeys.vaults.detail(vaultId) 
      });
      reloadVaults();
      toast.success("Key turned. Approval recorded.");
      if (data?.quorumReached) {
        toast.success("Quorum reached. Payout is being processed.", {
          duration: 6000,
        });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
