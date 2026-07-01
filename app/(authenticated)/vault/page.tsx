import { RequireActiveVault } from "@/components/providers/require-active-vault";
import { VaultDashboard } from "./_components/vault-dashboard";

export default function VaultPage() {
  return (
    <RequireActiveVault>
      <VaultDashboard />
    </RequireActiveVault>
  );
}
