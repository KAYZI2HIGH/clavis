export const queryKeys = {
  vaults: {
    all: ["vaults"] as const,
    detail: (vaultId: string) =>
      ["vaults", vaultId] as const,
    transactions: (vaultId: string) =>
      ["vaults", vaultId, "transactions"] as const,
  },
  reconciliation: (vaultId: string) =>
    ["reconciliation", vaultId] as const,
} as const;
