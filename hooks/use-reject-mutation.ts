import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import { useVault } from "@/hooks/use-vault";

export function useRejectMutation(vaultId: string) {
  const qc = useQueryClient();
  const { reloadVaults } = useVault();
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
    onSuccess: () => {
      qc.invalidateQueries({ 
        queryKey: queryKeys.vaults.detail(vaultId) 
      });
      reloadVaults();
      toast.success("Payout declined.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
