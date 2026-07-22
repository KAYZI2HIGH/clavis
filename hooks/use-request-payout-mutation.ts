import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
// import { useVault } from "@/hooks/use-vault";
// TODO: Batch 4 - Replace with URL-based React Query query invalidation

import type { Vault } from "@/lib/types";

export type RequestPayoutPayload = {
  recipientName: string;
  recipientAccount: string;
  recipientBankCode: string;
  recipientBankName: string;
  amountKobo: number;
  memo: string;
};

export function useRequestPayoutMutation(vaultId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RequestPayoutPayload) => {
      const res = await fetch(
        `/api/vaults/${vaultId}/transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to submit payout request");
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Eagerly prepend the transaction
      qc.setQueryData<import("@/lib/types").Vault>(
        queryKeys.vaults.detail(vaultId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            transactions: [data.transaction, ...(old.transactions ?? [])],
          };
        }
      );

      // Invalidate after delay for read replica
      setTimeout(() => {
        qc.invalidateQueries({ 
          queryKey: queryKeys.vaults.transactions(vaultId) 
        });
        qc.invalidateQueries({ 
          queryKey: queryKeys.vaults.detail(vaultId) 
        });
      }, 1500);

      toast.success("Payout request submitted.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
