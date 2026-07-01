"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyIcon } from "@/components/shared/key-icon";
import { useVault } from "@/hooks/use-vault";
import {
  CreateStepShell,
  RequireDraft,
} from "../_components/create-step-shell";

function CreateReviewContent() {
  const { state, foundVault } = useVault();
  const router = useRouter();
  const draft = state.draft!;
  const [founding, setFounding] = useState(false);
  const [progress, setProgress] = useState(0);

  const total = draft.stakeholders.length;
  const q = Math.min(draft.quorum, total);

  const doFound = () => {
    setFounding(true);
    let i = 0;
    const step = () => {
      i += 1;
      setProgress(i);
      if (i < total) {
        setTimeout(step, 320);
      } else {
        setTimeout(() => {
          foundVault();
          router.replace("/vault");
        }, 500);
      }
    };
    setTimeout(step, 200);
  };

  return (
    <CreateStepShell
      step={4}
      onBack={() => router.push("/vault/create/invite")}
    >
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
          {draft.stakeholders.map((sh, i) => (
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
                {sh.email && (
                  <p className="engraved text-ink-faint">{sh.email}</p>
                )}
              </div>
              <div
                className="key-anim"
                style={{ opacity: founding ? (i < progress ? 1 : 0.3) : 0.5 }}
              >
                <KeyIcon
                  filled={founding ? i < progress : false}
                  outlined={!founding}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-12 flex justify-end">
        <button
          className="btn-mech btn-mech-primary disabled:opacity-40"
          onClick={doFound}
          disabled={founding}
        >
          {founding ? "Cutting keys…" : "Found the Vault"}
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
