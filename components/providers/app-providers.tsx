"use client";

import { AuthProvider } from "./auth-provider";
import { VaultProvider } from "./vault-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <VaultProvider>
      <AuthProvider>{children}</AuthProvider>
    </VaultProvider>
  );
}
