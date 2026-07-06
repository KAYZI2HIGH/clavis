"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { KeyIcon } from "@/components/shared/key-icon";
import { CreateStepShell } from "@/app/(authenticated)/vault/create/_components/create-step-shell";
import { useVaultQuery } from "@/hooks/use-vault-query";
import { CreateStepSkeleton } from "@/components/vault/create-step-skeleton";
import { toast } from "sonner";

function CreateQuorumContent({ vaultId }: { vaultId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: vault, isLoading } = useVaultQuery(vaultId);

  const [quorum, setQuorum] = useState(1);

  useEffect(() => {
    if (vault?.quorum) {
      setQuorum(vault.quorum);
    }
  }, [vault?.quorum]);

  if (isLoading || !vault) {
    return <CreateStepSkeleton />;
  }

  const total = vault.stakeholders?.length ?? 2;
  const q = Math.min(quorum, total);

  const handleContinue = async () => {
    // Seeding React Query cache optimistically
    qc.setQueryData(
      queryKeys.vaults.detail(vaultId),
      (old: Record<string, unknown> | undefined) => old ? { ...old, quorum } : old
    );
    router.push(`/vault/create/${vaultId}/review`);

    // Fire in background
    fetch(`/api/vaults/${vaultId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quorum }),
    }).then(async (res) => {
      if (!res.ok) {
        // Rollback cache
        qc.invalidateQueries({ 
          queryKey: queryKeys.vaults.detail(vaultId) 
        });
        router.push(`/vault/create/${vaultId}/quorum`);
        toast.error("Failed to save quorum. Try again.");
      }
    }).catch(() => {
      qc.invalidateQueries({ 
        queryKey: queryKeys.vaults.detail(vaultId) 
      });
      router.push(`/vault/create/${vaultId}/quorum`);
      toast.error("Failed to save quorum. Try again.");
    });
  };

  return (
    <CreateStepShell step={3} onBack={() => router.push(`/vault/create/${vaultId}/invite`)}>
      <p className="engraved">Quorum rule</p>
      <h1 className="serif text-3xl text-ink mt-2 leading-tight">
        How many keys does it take to unlock a payout?
      </h1>
      <div className="mt-12 border hairline-strong bg-card p-8">
        <div className="flex items-center justify-center gap-4">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className="key-anim" style={{ opacity: i < q ? 1 : 0.35 }}>
              <KeyIcon filled={i < q} size={36} />
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-center gap-6">
          <button
            className="btn-mech btn-mech-ghost"
            onClick={() => setQuorum(Math.max(1, q - 1))}
            disabled={q <= 1}
          >
            −
          </button>
          <p className="serif text-4xl text-ink mono" style={{ minWidth: 88, textAlign: "center" }}>
            {q} <span className="text-ink-faint text-2xl">of {total}</span>
          </p>
          <button
            className="btn-mech btn-mech-ghost"
            onClick={() => setQuorum(Math.min(total, q + 1))}
            disabled={q >= total}
          >
            +
          </button>
        </div>
        <p className="text-center text-sm text-ink-muted mt-6">
          Any {q} of {total} partners must approve before a payout is sent.
        </p>
      </div>
      <div className="mt-12 flex justify-end">
        <button
          className="btn-mech btn-mech-ghost"
          onClick={handleContinue}
        >
          Continue
        </button>
      </div>
    </CreateStepShell>
  );
}

export default function CreateQuorumPage({
  params,
}: {
  params: Promise<{ vaultId: string }>;
}) {
  const { vaultId } = use(params);
  return <CreateQuorumContent vaultId={vaultId} />;
}
