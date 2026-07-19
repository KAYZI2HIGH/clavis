"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { CreateStepShell, RequireDraft } from "../../_components/create-step-shell";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { InvestmentType } from "@/lib/types";

export default function CreateTermsPage({ params }: { params: { vaultId: string } }) {
  const router = useRouter();
  const qc = useQueryClient();
  const vaultId = params.vaultId;

  const [type, setType] = useState<InvestmentType>("profit_share");
  const [profitShare, setProfitShare] = useState("50");
  const [monthlyFixed, setMonthlyFixed] = useState("");
  const [returnCap, setReturnCap] = useState("");
  const [termDuration, setTermDuration] = useState("12");
  const [settlementDay, setSettlementDay] = useState("1");
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);

    const payload = {
      investment_type: type,
      investor_profit_share: type !== "fixed_return" ? Number(profitShare) : null,
      investor_monthly_fixed: type !== "profit_share" ? Number(monthlyFixed) * 100 : null, // Convert to kobo if provided
      investor_return_cap: returnCap ? Number(returnCap) * 100 : null,
      term_duration_months: termDuration ? Number(termDuration) : null,
      settlement_day: Number(settlementDay) || 1,
    };

    // Optimistically update cache
    const existing: any = qc.getQueryData(queryKeys.vaults.detail(vaultId)) || {};
    qc.setQueryData(queryKeys.vaults.detail(vaultId), {
      ...existing,
      ...payload,
    });

    router.push(`/vault/create/${vaultId}/standing-orders`);

    // Background POST
    fetch(`/api/vaults/${vaultId}/terms`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      if (!res.ok) throw new Error("Failed to set terms");
    }).catch(() => {
      qc.setQueryData(queryKeys.vaults.detail(vaultId), existing);
      toast.error("Failed to save terms. Please try again.");
      router.push(`/vault/create/${vaultId}/terms`);
    });
  };

  return (
    <RequireDraft>
      <CreateStepShell step={2} onBack={() => router.push(`/vault/create/name`)}>
        <p className="engraved">Investment Terms</p>
        <h1 className="serif text-3xl text-ink mt-2 leading-tight">
          How will returns be structured?
        </h1>
        
        <div className="mt-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: "profit_share", label: "Profit Share", desc: "Split net revenue" },
              { id: "fixed_return", label: "Fixed Return", desc: "Flat monthly payment" },
              { id: "hybrid", label: "Hybrid", desc: "Fixed + smaller share" }
            ].map(t => (
              <div 
                key={t.id} 
                onClick={() => setType(t.id as InvestmentType)}
                className={`border hairline-strong p-4 cursor-pointer transition-all ${type === t.id ? "bg-ink text-paper" : "bg-card hover:bg-secondary/60 text-ink"}`}
              >
                <p className={`serif text-lg ${type === t.id ? "text-paper" : "text-ink"}`}>{t.label}</p>
                <p className={`text-xs mt-1 ${type === t.id ? "text-paper/70" : "text-ink-muted"}`}>{t.desc}</p>
              </div>
            ))}
          </div>

          <div className="border hairline-strong bg-card p-6 mt-6 space-y-6">
            {(type === "profit_share" || type === "hybrid") && (
              <div>
                <label className="engraved block mb-2">Your Profit Share (%)</label>
                <input 
                  type="number" 
                  className="input-mech w-full" 
                  value={profitShare} 
                  onChange={e => setProfitShare(e.target.value)} 
                  placeholder="e.g. 50"
                />
              </div>
            )}

            {(type === "fixed_return" || type === "hybrid") && (
              <div>
                <label className="engraved block mb-2">Fixed Monthly Return (₦)</label>
                <input 
                  type="number" 
                  className="input-mech w-full" 
                  value={monthlyFixed} 
                  onChange={e => setMonthlyFixed(e.target.value)} 
                  placeholder="e.g. 100000"
                />
              </div>
            )}

            <div>
              <label className="engraved block mb-2">Term Duration (Months) - Optional</label>
              <input 
                type="number" 
                className="input-mech w-full" 
                value={termDuration} 
                onChange={e => setTermDuration(e.target.value)} 
                placeholder="e.g. 12"
              />
            </div>

            <div>
              <label className="engraved block mb-2">Settlement Day of Month</label>
              <input 
                type="number" 
                min="1" 
                max="28"
                className="input-mech w-full" 
                value={settlementDay} 
                onChange={e => setSettlementDay(e.target.value)} 
                placeholder="1"
              />
              <p className="text-xs text-ink-muted mt-2">Returns are calculated and disbursed on this day every month.</p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-end">
          <button
            className="btn-mech btn-mech-ghost disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 w-full sm:w-auto"
            onClick={handleContinue}
            disabled={loading}
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {loading ? "Saving…" : "Continue"}
          </button>
        </div>
      </CreateStepShell>
    </RequireDraft>
  );
}
