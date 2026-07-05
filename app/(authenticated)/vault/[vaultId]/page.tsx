"use client";
import { use } from "react";
import { VaultDashboardSkeleton } from "./_components/vault-dashboard-skeleton";

export default function VaultPage({
  params,
}: {
  params: Promise<{ vaultId: string }>;
}) {
  const { vaultId } = use(params);
  return <VaultDashboardSkeleton />;
}
