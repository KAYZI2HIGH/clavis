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

  const [quorum, setQuorum] = useState(2);

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
      (old: any) => old ? { ...old, quorum } : old
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
      <p className="engraved">Quorum</p>
      <h1 className="serif text-3xl text-ink mt-2 leading-tight">
        Quorum requirement
      </h1>
      <p className="text-sm text-ink-muted mt-2">
        How many keys are required to approve any transfer?
      </p>

      <div className="mt-8 flex items-center justify-between border hairline-strong bg-card p-6">
        <div>
          <p className="serif text-4xl text-ink tracking-tight">
            {q} <span className="text-xl text-ink-muted">of {total}</span>
          </p>
          <p className="engraved text-xs text-ink-faint mt-1">
            Requires {q} partner approvals
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setQuorum((prev) => Math.max(prev - 1, 1))}
            className="btn-mech btn-mech-ghost w-10 h-10 flex items-center justify-center text-lg"
          >
            -
          </button>
          <button
            onClick={() => setQuorum((prev) => Math.min(prev + 1, total))}
            className="btn-mech btn-mech-ghost w-10 h-10 flex items-center justify-center text-lg"
          >
            +
          </button>
        </div>
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
