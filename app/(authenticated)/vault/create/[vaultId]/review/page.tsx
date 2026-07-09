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

  const liveStakeholders = vault.stakeholders ?? [];
  const total = liveStakeholders.length;
  const q = Math.min(vault.quorum ?? 1, Math.max(total, 1));

  const doFound = () => {
    setFounding(true);
    let i = 0;

    const step = () => {
      i += 1;
      setProgress(i);
      if (i < total) {
        setTimeout(step, 320);
      } else {
        setTimeout(async () => {
          try {
            // Read email invites staged on the invite step
            let emailStakeholders: { name: string; email: string; initials: string }[] = [];
            try {
              const raw = sessionStorage.getItem("draft_email_invites");
              if (raw) emailStakeholders = JSON.parse(raw);
            } catch { /* ignore */ }

            // Step 1: Send the Patch request to update staged email stakeholders if method is email
            const method = vault.quorum !== undefined ? "link" : "email"; // Fallback/logic placeholder
            if (method === "email" && emailStakeholders.length > 0) {
              await fetch(`/api/vaults/${vaultId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  quorum: vault.quorum,
                  emailStakeholders,
                }),
              });
            }

            // Step 2: Found/activate vault and setup Nomba account
            const res = await fetch(`/api/vaults/${vaultId}/found`, {
              method: "POST",
            });

            if (!res.ok) {
              const payload = await res.json().catch(() => ({}));
              toast.error(payload.error ?? "Failed to found vault. Please try again.");
              setFounding(false);
              return;
            }

            sessionStorage.removeItem("draft_email_invites");
            clearDraft();
            qc.invalidateQueries({ queryKey: queryKeys.vaults.all });
            toast.success("Vault created successfully");
            router.replace(`/vault/${vaultId}`);
          } catch {
            toast.error("Failed to found vault. Please try again.");
            setFounding(false);
          }
        }, 500);
      }
    };

    setTimeout(step, 200);
  };

  return (
    <CreateStepShell step={4} onBack={() => router.push(`/vault/create/${vaultId}/quorum`)}>
      <p className="review">Review</p>
      <h1 className="serif text-3xl text-ink mt-2 leading-tight">
        {vault.name || "Untitled Vault"}
      </h1>
      <p className="text-sm text-ink-muted mt-2">
        Requires {q} of {total} keys.
      </p>
      <div className="mt-10 border hairline-strong bg-card">
        <div className="px-5 py-4 border-b hairline">
          <p className="engraved">Stakeholders</p>
        </div>
        <div className="divide-y hairline">
          {liveStakeholders.map((sh, i) => (
            <div key={sh.id} className="flex items-center gap-3 px-5 py-3">
              <div
                className="w-7 h-7 border hairline-strong flex items-center justify-center mono text-[10px] text-ink"
                style={{ borderRadius: 999 }}
              >
                {sh.initials}
              </div>
              <div className="flex-1">
                <p className="text-sm text-ink">
                  {sh.name}{" "}
                  {sh.isFounder && (
                    <span className="engraved text-brass-deep ml-1">You</span>
                  )}
                </p>
                {sh.email && <p className="engraved text-ink-faint">{sh.email}</p>}
              </div>
              <div
                className="key-anim"
                style={{ opacity: founding ? (i < progress ? 1 : 0.3) : 0.5 }}
              >
                <KeyIcon filled={founding ? i < progress : false} outlined={!founding} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-12 flex justify-end">
        <button
          className="btn-mech btn-mech-primary disabled:opacity-40 flex items-center gap-2 w-full sm:w-auto"
          onClick={doFound}
          disabled={founding}
        >
          {founding ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Cutting keys…</span>
            </>
          ) : (
            "Found the Vault"
          )}
        </button>
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
