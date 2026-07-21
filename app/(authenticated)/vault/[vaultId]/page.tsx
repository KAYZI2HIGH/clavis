"use client";

import { use } from "react";
import { useVaultQuery } from "@/hooks/use-vault-query";
import { VaultDashboard } from "./_components/vault-dashboard";
import { InvestorDashboard } from "./_components/investor-dashboard";
import { VaultDashboardSkeleton } from "./_components/vault-dashboard-skeleton";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function VaultPage({
  params,
}: {
  params: Promise<{ vaultId: string }>;
}) {
  const { vaultId } = use(params);
  const router = useRouter();
  const { 
    data: vault, 
    isLoading, 
    error,
    isError,
  } = useVaultQuery(vaultId);

  useEffect(() => {
    if (isError) {
      setTimeout(() => router.push("/home"), 2000);
    }
  }, [isError, router]);

  if (isLoading) return <VaultDashboardSkeleton />;

  if (isError || !vault) {
    return (
      <div className="min-h-screen bg-paper grain flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="serif text-xl text-ink">
            Vault not found
          </p>
          <p className="engraved text-ink-muted">
            Redirecting you home...
          </p>
        </div>
      </div>
    );
  }

  const isInvestor = vault.investorId === vault.youId;

  if (isInvestor) return <InvestorDashboard vault={vault} vaultId={vaultId} />;
  return <VaultDashboard vault={vault} vaultId={vaultId} />;
}
