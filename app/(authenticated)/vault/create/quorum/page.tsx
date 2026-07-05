"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyIcon } from "@/components/shared/key-icon";
// import { useVault } from "@/hooks/use-vault";
// TODO: Batch 4 - Replace with URL-based / React Query dynamic state creation
import { CreateStepShell, RequireDraft } from "../_components/create-step-shell";

function CreateQuorumContent() {
  // const { state, setDraftQuorum } = useVault();
  const state = { draft: { vaultId: "", stakeholders: [], quorum: 1 } } as any;
  const setDraftQuorum = (() => {}) as any;
  const router = useRouter();
  const draft = state.draft!;

  // Fetch real stakeholder count from DB (since vault already exists)
  const [liveCount, setLiveCount] = useState<number | null>(null);
  useEffect(() => {
    if (!draft.vaultId) return;
    fetch(`/api/vaults/${draft.vaultId}/stakeholders`)
      .then((r) => r.json())
      .then((d) => setLiveCount((d.stakeholders ?? []).length))
      .catch(() => {});
  }, [draft.vaultId]);

  const total = liveCount ?? Math.max(draft.stakeholders.length, 2);
  const q = Math.min(draft.quorum, total);

  return (
    <CreateStepShell step={3} onBack={() => router.push("/vault/create/invite")}>
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
            onClick={() => setDraftQuorum(Math.max(1, q - 1))}
            disabled={q <= 1}
          >
            −
          </button>
          <p className="serif text-4xl text-ink mono" style={{ minWidth: 88, textAlign: "center" }}>
            {q} <span className="text-ink-faint text-2xl">of {total}</span>
          </p>
          <button
            className="btn-mech btn-mech-ghost"
            onClick={() => setDraftQuorum(Math.min(total, q + 1))}
            disabled={q >= total}
          >
            +
          </button>
        </div>
        <p className="text-center text-sm text-ink-muted mt-6">
          Any {q} of {total} partners must approve before a payout is sent.
        </p>
      </div>
      {liveCount === null && (
        <p className="text-xs text-ink-faint mt-4">
          Fetching live partner count…
        </p>
      )}
      <div className="mt-12 flex justify-end">
        <button
          className="btn-mech btn-mech-ghost"
          onClick={() => router.push("/vault/create/review")}
        >
          Continue
        </button>
      </div>
    </CreateStepShell>
  );
}

export default function CreateQuorumPage() {
  return (
    <RequireDraft>
      <CreateQuorumContent />
    </RequireDraft>
  );
}
