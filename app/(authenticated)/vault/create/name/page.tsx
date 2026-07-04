"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/hooks/use-vault";
import { CreateStepShell, RequireDraft } from "../_components/create-step-shell";

function CreateNameContent() {
  const { state, setDraftName, setDraftMethod, setDraftVaultId } = useVault();
  const router = useRouter();
  const draft = state.draft!;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = draft.name.trim().length > 0;

  const handleContinue = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/vaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, method: draft.method ?? "link" }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error ?? "Failed to create vault. Please try again.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setDraftVaultId(data.id, data.linkToken);
      router.push("/vault/create/invite");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

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
          onKeyDown={(e) => e.key === "Enter" && handleContinue()}
          placeholder="Riverside Holdings"
          disabled={loading}
        />
        <p className="text-sm text-ink-muted mt-3">
          This is the name your partners will see when they&apos;re invited.
        </p>
        {error && <p className="text-sm text-crimson mt-3">{error}</p>}
      </div>

      {/* Invite method toggle — set early so POST knows which token to create */}
      <div className="mt-8">
        <p className="engraved mb-3">Invite method</p>
        <div className="inline-flex border hairline-strong" style={{ borderRadius: 2 }}>
          {(["link", "email"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setDraftMethod(m)}
              disabled={loading}
              className={`px-4 py-2 text-sm transition-colors ${draft.method === m ? "bg-ink text-paper" : "text-ink-muted hover:text-ink"}`}
            >
              {m === "link" ? "Share a Link" : "Invite by Email"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 flex justify-end">
        <button
          className="btn-mech btn-mech-ghost disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handleContinue}
          disabled={!valid || loading}
        >
          {loading ? "Creating vault…" : "Continue"}
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
