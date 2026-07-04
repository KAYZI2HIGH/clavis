import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import type { Vault } from "@/lib/types";

export type CreateVaultPayload = {
  name: string;
  quorum: number;
  method: "link" | "email";
  stakeholders: Array<{ name: string; email?: string }>;
  linkToken?: string;
  vaultId?: string;
};

export function useCreateVaultMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateVaultPayload) => {
      const res = await fetch("/api/vaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to create vault");
      }
      return res.json() as Promise<Vault>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vaults.all });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
