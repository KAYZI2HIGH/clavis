"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "./auth-provider";
import { VaultProvider } from "./vault-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <VaultProvider>
          <AuthProvider>{children}</AuthProvider>
        </VaultProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
