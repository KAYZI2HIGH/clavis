"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { CreateStepShell, RequireDraft } from "../../_components/create-step-shell";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { StandingOrderAction } from "@/lib/types";

export default function CreateReviewPage({ params }: { params: { vaultId: string } }) {
  const router = useRouter();
  const qc = useQueryClient();
  const vaultId = params.vaultId;

  const [loading, setLoading] = useState(false);

  // Read the optimistically cached vault data
  const vault: any = qc.getQueryData(queryKeys.vaults.detail(vaultId)) || {};

  const handleActivate = async () => {
    setLoading(true);

    try {
      const res = await fetch(`/api/vaults/${vaultId}/activate`, {
        method: "POST",
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || "Failed to activate vault");
      }

      toast.success("Vault activated successfully");
      
      // Clear cache and invalidate all vaults to fetch the newly active vault
      qc.invalidateQueries({ queryKey: queryKeys.vaults.all });
      router.push(`/vault/${vaultId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to activate vault. Please try again.");
      setLoading(false);
    }
  };

  const formatAction = (action: StandingOrderAction) => {
    switch(action) {
      case "auto_execute": return "Auto-execute payment";
      case "operator_quorum_only": return "Require operator quorum only";
      case "always_require_investor": return "Always require my approval";
      case "notify_then_execute": return "Notify me, then execute";
      default: return action;
    }
  };

  return (
    <RequireDraft>
      <CreateStepShell step={6} onBack={() => router.push(`/vault/create/${vaultId}/fund`)}>
        <p className="engraved">Review & Activate</p>
        <h1 className="serif text-3xl text-ink mt-2 leading-tight">
          Ready to deploy {vault.name || "your vault"}?
        </h1>
        <p className="text-sm text-ink-muted mt-3">
          Review your investment terms and standing orders. Activating the vault will lock these rules.
        </p>

        <div className="mt-10 space-y-8">
          <div>
            <h3 className="engraved mb-4">Investment Terms</h3>
            <div className="border hairline-strong bg-card p-5">
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-sm text-ink-muted">Structure</dt>
                  <dd className="text-sm text-ink uppercase font-semibold">
                    {vault.investment_type?.replace("_", " ")}
                  </dd>
                </div>
                {vault.investor_profit_share && (
                  <div className="flex justify-between border-t hairline pt-4">
                    <dt className="text-sm text-ink-muted">Profit Share</dt>
                    <dd className="text-sm text-ink">{vault.investor_profit_share}%</dd>
                  </div>
                )}
                {vault.investor_monthly_fixed && (
                  <div className="flex justify-between border-t hairline pt-4">
                    <dt className="text-sm text-ink-muted">Fixed Monthly</dt>
                    <dd className="text-sm text-ink">₦{(vault.investor_monthly_fixed / 100).toLocaleString()}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t hairline pt-4">
                  <dt className="text-sm text-ink-muted">Settlement Day</dt>
                  <dd className="text-sm text-ink">Day {vault.settlement_day || 1}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div>
            <h3 className="engraved mb-4">Standing Orders</h3>
            {vault.standing_orders?.length > 0 ? (
              <div className="border hairline-strong bg-card divide-y hairline">
                {vault.standing_orders.map((order: any, idx: number) => (
                  <div key={idx} className="p-5">
                    <p className="serif text-lg text-ink mb-2">{order.plain_language}</p>
                    <p className="text-xs text-ink-muted uppercase tracking-wider bg-secondary/10 px-2 py-1 inline-block rounded-sm">
                      {formatAction(order.action)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No standing orders configured. All transactions will require manual approval.</p>
            )}
          </div>
        </div>

        <div className="mt-16 pt-8 border-t hairline">
          <button
            className="btn-mech flex items-center justify-center gap-2 w-full text-lg py-5"
            onClick={handleActivate}
            disabled={loading}
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {loading ? "Activating Vault…" : "Activate Vault"}
          </button>
        </div>
      </CreateStepShell>
    </RequireDraft>
  );
}
