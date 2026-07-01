import { useVaultContext } from "@/components/providers/vault-provider";

export function useVault() {
  return useVaultContext();
}
