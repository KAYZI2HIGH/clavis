import type { VaultAppState } from "./types";

export function getInitialVaultState(): VaultAppState {
  return {
    vaults: [],
    activeVaultId: null,
    currentPartner: "",
    draft: null,
  };
}
