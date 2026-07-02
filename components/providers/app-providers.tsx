"use client";

import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "./auth-provider";
import { VaultProvider } from "./vault-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <VaultProvider>
        <AuthProvider>{children}</AuthProvider>
      </VaultProvider>
    </SessionProvider>
  );
}
