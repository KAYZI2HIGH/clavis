import { useActiveVault } from "./use-vault";

export function useMembers() {
  const vault = useActiveVault();
  return vault?.stakeholders ?? [];
}

export function usePartnerById() {
  const vault = useActiveVault();
  return (id: string) => vault?.stakeholders.find((p) => p.id === id);
}
