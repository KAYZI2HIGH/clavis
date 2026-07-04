"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth-provider";
import { VaultProvider } from "./vault-provider";
import { useState } from "react";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 3000 } },
  }));

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
