"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyIcon } from "@/components/shared/key-icon";
// import { useVault } from "@/hooks/use-vault";
// TODO: Batch 4 - Replace with URL-based / React Query dynamic review state
import { CreateStepShell, RequireDraft } from "../_components/create-step-shell";
import { Loader2 } from "lucide-react";

type LiveStakeholder = { id: string; name: string; initials: string; isFounder?: boolean; email?: string };

function CreateReviewContent() {
  // const { state, foundVault } = useVault();
  const state = { draft: { vaultId: "", stakeholders: [], name: "", quorum: 1 } } as any;
  const foundVault = (() => {}) as any;
  const router = useRouter();
  const draft = state.draft!;
  const [founding, setFounding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liveStakeholders, setLiveStakeholders] = useState<LiveStakeholder[]>(draft.stakeholders);

  // Fetch real stakeholder list for the animation
  useEffect(() => {
    if (!draft.vaultId) return;
    fetch(`/api/vaults/${draft.vaultId}/stakeholders`)
      .then((r) => r.json())
      .then((d) => {
        if (d.stakeholders?.length) setLiveStakeholders(d.stakeholders);
      })
      .catch(() => {});
  }, [draft.vaultId]);

  const total = liveStakeholders.length;
  const q = Math.min(draft.quorum, Math.max(total, 1));

  const doFound = () => {
    if (!draft.vaultId) {
      toast.error("Vault ID missing. Please restart the creation flow.");
      return;
    }
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

            const res = await fetch(`/api/vaults/${draft.vaultId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                quorum: draft.quorum,
                emailStakeholders: draft.method === "email" ? emailStakeholders : [],
              }),
            });

            if (!res.ok) {
              const payload = await res.json().catch(() => ({}));
              toast.error(payload.error ?? "Failed to found vault. Please try again.");
              setFounding(false);
              return;
            }

            const vault = await res.json();
            sessionStorage.removeItem("draft_email_invites");
            foundVault(vault);
            toast.success("Vault founded successfully");
            router.replace("/vault");
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
    <CreateStepShell step={4} onBack={() => router.push("/vault/create/quorum")}>
      <p className="engraved">Review</p>
      <h1 className="serif text-3xl text-ink mt-2 leading-tight">
        {draft.name || "Untitled Vault"}
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
          className="btn-mech btn-mech-primary disabled:opacity-40 flex items-center gap-2"
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

export default function CreateReviewPage() {
  return (
    <RequireDraft>
      <CreateReviewContent />
    </RequireDraft>
  );
}
