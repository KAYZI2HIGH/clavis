import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";

export function useRetryVAMutation(vaultId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}/fund`, {
        method: "POST",
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to set up account");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ 
        queryKey: queryKeys.vaults.detail(vaultId) 
      });
      qc.invalidateQueries({ 
        queryKey: queryKeys.vaults.all 
      });
      toast.success("Funding account set up successfully.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
