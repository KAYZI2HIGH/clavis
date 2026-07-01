import { useVault } from "./use-vault";

export function useMembers() {
  const { state } = useVault();
  return state.members;
}

export function usePartnerById() {
  const members = useMembers();
  return (id: string) => members.find((p) => p.id === id);
}
