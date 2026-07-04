export const queryKeys = {
  vaults: {
    all: ["vaults"] as const,
    detail: (vaultId: string) => 
      ["vaults", vaultId] as const,
    transactions: (vaultId: string) => 
      ["vaults", vaultId, "transactions"] as const,
    members: (vaultId: string) => 
      ["vaults", vaultId, "members"] as const,
  },
  user: {
    me: ["user", "me"] as const,
  },
} as const;
