"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { CreateStepShell, RequireDraft } from "../../_components/create-step-shell";
import { toast } from "sonner";
import { KeyIcon } from "@/components/shared/key-icon";
import { Copy, CheckCircle2 } from "lucide-react";
import type { Vault } from "@/lib/types";

export default function CreateInvitePage({ params }: { params: Promise<{ vaultId: string }> }) {
  const router = useRouter();
  const { vaultId } = use(params);
  
  const [copied, setCopied] = useState(false);

  // Poll for stakeholders (or rely on React Query refetch intervals)
  const { data: vault } = useQuery<Vault>({
    queryKey: queryKeys.vaults.detail(vaultId),
    queryFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 3000, // Poll every 3s to see new joins
  });

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join-vault?token=${vaultId}`
    : `/join-vault?token=${vaultId}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleContinue = () => {
    router.push(`/vault/create/${vaultId}/fund`);
  };

  const stakeholders = vault?.stakeholders || [];

  return (
    <RequireDraft>
      <CreateStepShell step={4} onBack={() => router.push(`/vault/create/${vaultId}/standing-orders`)}>
        <p className="engraved">Operators</p>
        <h1 className="serif text-3xl text-ink mt-2 leading-tight">
          Invite your operators
        </h1>
        <p className="text-sm text-ink-muted mt-3">
          Share this link with your operators. When they join, they will appear below.
        </p>
        
        <div className="mt-8 space-y-6">
          <div className="border hairline-strong bg-card p-6">
            <p className="engraved mb-2">Invitation link</p>
            <div className="flex items-center gap-2">
              <div className="mono text-xs text-ink bg-paper border hairline-strong px-3 py-3 break-all flex-1" style={{ borderRadius: 2 }}>
                {inviteUrl}
              </div>
              <button 
                className="btn-mech btn-mech-ghost px-4 h-full"
                onClick={copy}
                aria-label="Copy link"
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-secondary" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-ink-muted mt-3">
              Anyone with this link can join as an operator for this vault.
            </p>
          </div>

          <div className="mt-10">
            <p className="engraved mb-3">Joined Key-holders</p>
            <div className="border hairline-strong bg-card divide-y hairline min-h-[100px]">
              {stakeholders.length > 0 ? stakeholders.map((sh) => (
                <div key={sh.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="w-7 h-7 border hairline-strong flex items-center justify-center mono text-[10px] text-ink"
                    style={{ borderRadius: 999 }}
                  >
                    {sh.initials}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-ink">
                      {sh.name}
                      {sh.isFounder && (
                        <span className="engraved text-brass-deep ml-1">You</span>
                      )}
                      {!sh.isFounder && (
                        <span className="engraved text-secondary ml-1">Operator</span>
                      )}
                    </p>
                    {sh.email && (
                      <p className="engraved text-ink-faint">{sh.email}</p>
                    )}
                  </div>
                  <KeyIcon outlined />
                </div>
              )) : (
                <div className="flex items-center justify-center h-[100px] text-sm text-ink-faint">
                  Waiting for operators to join...
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-end">
          <button
            className="btn-mech btn-mech-ghost w-full sm:w-auto"
            onClick={handleContinue}
          >
            Continue to Funding
          </button>
        </div>
      </CreateStepShell>
    </RequireDraft>
  );
}
