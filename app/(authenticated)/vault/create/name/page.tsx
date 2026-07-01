"use client";

import { useRouter } from "next/navigation";
import { useVault } from "@/hooks/use-vault";
import {
  CreateStepShell,
  RequireDraft,
} from "../_components/create-step-shell";

function CreateNameContent() {
  const { state, setDraftName } = useVault();
  const router = useRouter();
  const draft = state.draft!;
  const valid = draft.name.trim().length > 0;

  return (
    <CreateStepShell step={1} onBack={() => router.push("/home")}>
      <p className="engraved">Name</p>
      <h1 className="serif text-3xl text-ink mt-2 leading-tight">
        What is this vault for?
      </h1>
      <div className="mt-8">
        <input
          autoFocus
          className="input-mech"
          value={draft.name}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Riverside Holdings"
        />
        <p className="text-sm text-ink-muted mt-3">
          This is the name your partners will see when they&apos;re invited.
        </p>
      </div>
      <div className="mt-12 flex justify-end">
        <button
          className="btn-mech btn-mech-ghost disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => router.push("/vault/create/quorum")}
          disabled={!valid}
        >
          Continue
        </button>
      </div>
    </CreateStepShell>
  );
}

export default function CreateNamePage() {
  return (
    <RequireDraft>
      <CreateNameContent />
    </RequireDraft>
  );
}
