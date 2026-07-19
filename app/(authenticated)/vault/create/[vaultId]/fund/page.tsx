"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateStepShell, RequireDraft } from "../../_components/create-step-shell";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2 } from "lucide-react";

export default function CreateFundPage({ params }: { params: { vaultId: string } }) {
  const router = useRouter();
  const vaultId = params.vaultId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [revenueAccount, setRevenueAccount] = useState<{accountNumber: string, bankName: string} | null>(null);
  const [capitalAccount, setCapitalAccount] = useState<{accountNumber: string, bankName: string} | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch(`/api/vaults/${vaultId}/fund`, { method: "POST" });
        if (!res.ok) throw new Error("Failed to generate funding accounts");
        const data = await res.json();
        setRevenueAccount(data.revenueAccount);
        setCapitalAccount(data.capitalAccount);
      } catch (err) {
        setError("Could not generate funding accounts. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, [vaultId]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied to clipboard");
  };

  const handleContinue = () => {
    router.push(`/vault/create/${vaultId}/review`);
  };

  return (
    <RequireDraft>
      <CreateStepShell step={5} onBack={() => router.push(`/vault/create/${vaultId}/invite`)}>
        <p className="engraved">Funding</p>
        <h1 className="serif text-3xl text-ink mt-2 leading-tight">
          Fund the vault
        </h1>
        <p className="text-sm text-ink-muted mt-3">
          Your vault accounts have been generated. Transfer your initial capital into the Capital Account below.
        </p>

        {loading ? (
          <div className="mt-12 flex flex-col items-center justify-center py-12 border hairline-strong bg-card">
            <Loader2 className="h-8 w-8 animate-spin text-ink-muted mb-4" />
            <p className="text-sm text-ink-muted">Generating secure Monnify accounts...</p>
          </div>
        ) : error ? (
          <div className="mt-8 border hairline-strong bg-card p-6 text-center">
            <p className="text-crimson text-sm mb-4">{error}</p>
            <button 
              className="btn-mech btn-mech-ghost"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="border hairline-strong bg-card p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="engraved text-ink">Capital Account</p>
                <span className="text-[10px] uppercase tracking-widest text-ink-faint bg-ink/5 px-2 py-0.5 rounded-sm">Deposit Initial Capital</span>
              </div>
              <div className="mt-4 flex items-center justify-between bg-paper border hairline p-4 rounded-sm">
                <div>
                  <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">{capitalAccount?.bankName}</p>
                  <p className="mono text-2xl text-ink">{capitalAccount?.accountNumber}</p>
                </div>
                <button 
                  onClick={() => handleCopy(capitalAccount?.accountNumber || "")}
                  className="p-2 text-ink-muted hover:text-ink transition-colors"
                >
                  {copied === capitalAccount?.accountNumber ? <CheckCircle2 className="h-5 w-5 text-secondary" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="border hairline-strong bg-card p-6 opacity-70 hover:opacity-100 transition-opacity">
              <div className="flex items-center justify-between mb-2">
                <p className="engraved text-ink">Revenue Account</p>
                <span className="text-[10px] uppercase tracking-widest text-ink-faint bg-ink/5 px-2 py-0.5 rounded-sm">For Customer Inflows</span>
              </div>
              <div className="mt-4 flex items-center justify-between bg-paper border hairline p-4 rounded-sm">
                <div>
                  <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">{revenueAccount?.bankName}</p>
                  <p className="mono text-2xl text-ink">{revenueAccount?.accountNumber}</p>
                </div>
                <button 
                  onClick={() => handleCopy(revenueAccount?.accountNumber || "")}
                  className="p-2 text-ink-muted hover:text-ink transition-colors"
                >
                  {copied === revenueAccount?.accountNumber ? <CheckCircle2 className="h-5 w-5 text-secondary" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 flex justify-end">
          <button
            className="btn-mech btn-mech-ghost disabled:opacity-40 flex items-center gap-1.5 w-full sm:w-auto"
            onClick={handleContinue}
            disabled={loading || !!error}
          >
            Review & Activate
          </button>
        </div>
      </CreateStepShell>
    </RequireDraft>
  );
}
