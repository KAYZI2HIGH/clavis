import { useVaultContext } from "@/components/providers/vault-provider";

export function useVault() {
  return useVaultContext();
}

export function useActiveVault() {
  const { activeVault } = useVaultContext();
  return activeVault;
}
