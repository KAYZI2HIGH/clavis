import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";

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
    onSuccess: () => {
      qc.invalidateQueries({ 
        queryKey: queryKeys.vaults.detail(vaultId) 
      });
      toast.success("Key turned. Approval recorded.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
