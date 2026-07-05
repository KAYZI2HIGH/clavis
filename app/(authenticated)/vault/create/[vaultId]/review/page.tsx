"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import { KeyIcon } from "@/components/shared/key-icon";
import { CreateStepShell } from "@/app/(authenticated)/vault/create/_components/create-step-shell";
import { useVaultQuery } from "@/hooks/use-vault-query";
import { CreateStepSkeleton } from "@/components/vault/create-step-skeleton";
import { Loader2 } from "lucide-react";
import { clearDraft } from "@/lib/draft";

type LiveStakeholder = { id: string; name: string; initials: string; isFounder?: boolean; email?: string };

function CreateReviewContent({ vaultId }: { vaultId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: vault, isLoading } = useVaultQuery(vaultId);

  const [founding, setFounding] = useState(false);
  const [progress, setProgress] = useState(0);

  if (isLoading || !vault) {
    return <CreateStepSkeleton />;
  }

  const handleFound = async () => {
    if (founding) return;
    setFounding(true);
    setProgress(10);

    // Play visual step progression updates
    const t = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(t);
          return 90;
        }
        return prev + 15;
      });
    }, 150);

    try {
      const res = await fetch(`/api/vaults/${vaultId}/found`, {
        method: "POST",
      });

      if (!res.ok) {
        clearInterval(t);
        setFounding(false);
        setProgress(0);
        toast.error("Failed to activate vault");
        return;
      }

      clearInterval(t);
      setProgress(100);
      setTimeout(() => {
        clearDraft();
        qc.invalidateQueries({ queryKey: queryKeys.vaults.all });
        toast.success("Vault created successfully");
        router.push(`/vault/${vaultId}`);
      }, 500);
    } catch {
      clearInterval(t);
      setFounding(false);
      setProgress(0);
      toast.error("Failed to activate vault");
    }
  };

  const total = vault.stakeholders?.length ?? 2;
  const q = vault.quorum ?? 2;

  return (
    <CreateStepShell step={4} onBack={() => router.push(`/vault/create/${vaultId}/quorum`)}>
      <p className="engraved">Review</p>
      <h1 className="serif text-3xl text-ink mt-2 leading-tight">
        Confirm vault setup
      </h1>

      <div className="mt-8 space-y-6">
        <div className="border hairline-strong bg-card p-6">
          <p className="engraved">Vault name</p>
          <p className="serif text-2xl text-ink mt-1">{vault.name}</p>
        </div>

        <div className="border hairline-strong bg-card p-6">
          <p className="engraved">Quorum threshold</p>
          <p className="serif text-2xl text-ink mt-1">
            {q} of {total} key-holders
          </p>
        </div>

        <div className="border hairline-strong bg-card divide-y hairline">
          {vault.stakeholders?.map((sh: any) => (
            <div key={sh.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-7 h-7 border hairline-strong flex items-center justify-center mono text-[10px] text-ink" style={{ borderRadius: 999 }}>
                {sh.initials}
              </div>
              <div className="flex-1">
                <p className="text-sm text-ink">
                  {sh.name} {sh.isFounder && <span className="engraved text-brass-deep ml-1">Founder</span>}
                </p>
              </div>
              <KeyIcon filled />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 flex flex-col gap-4">
        {founding && (
          <div className="w-full bg-secondary h-1.5 overflow-hidden" style={{ borderRadius: 1 }}>
            <div className="bg-ink h-full transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        )}
        <div className="flex justify-end">
          <button
            className="btn-mech btn-mech-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            onClick={handleFound}
            disabled={founding}
          >
            {founding && <Loader2 className="h-3 w-3 animate-spin" />}
            {founding ? "Founding Vault…" : "Found the Vault"}
          </button>
        </div>
      </div>
    </CreateStepShell>
  );
}

export default function CreateReviewPage({
  params,
}: {
  params: Promise<{ vaultId: string }>;
}) {
  const { vaultId } = use(params);
  return <CreateReviewContent vaultId={vaultId} />;
}
