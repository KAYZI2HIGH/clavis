"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { makeId, makeInitials } from "@/lib/vault-utils";
import { CreateStepShell } from "../_components/create-step-shell";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function CreateNamePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length > 0;

  const handleContinue = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError(null);

    const vaultId = makeId("v");

    // Seed React Query cache optimistically
    qc.setQueryData(queryKeys.vaults.detail(vaultId), {
      id: vaultId,
      name: name.trim(),
      status: "draft",
      balance_kobo: 0,
      total_invested_kobo: 0,
      total_settled_kobo: 0,
      quorum: 1,
      stakeholders: [],
      transactions: [],
      standing_orders: [],
    });

    // Navigate immediately
    router.push(`/vault/create/${vaultId}/terms`);

    // POST in background
    fetch("/api/vaults/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), vaultId }),
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error("Failed to create vault");
      }
    }).catch(() => {
      // Revert cache and navigation on error
      qc.removeQueries({ queryKey: queryKeys.vaults.detail(vaultId) });
      toast.error("Failed to start vault setup. Please try again.");
      router.push("/home");
    });
  };

  return (
    <CreateStepShell step={1} onBack={() => router.push("/home")}>
      <p className="engraved">Name</p>
      <h1 className="serif text-3xl text-ink mt-2 leading-tight">
        Name your investment
      </h1>
      <div className="mt-8">
        <input
          autoFocus
          className="input-mech"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleContinue()}
          placeholder="Riverside Holdings"
          disabled={loading}
        />
        <p className="text-sm text-ink-muted mt-3">
          Give this deal a name your operators will recognise
        </p>
        {error && <p className="text-sm text-crimson mt-3">{error}</p>}
      </div>

      <div className="mt-12 flex justify-end">
        <button
          className="btn-mech btn-mech-ghost disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 w-full sm:w-auto"
          onClick={handleContinue}
          disabled={!valid || loading}
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          {loading ? "Starting…" : "Continue"}
        </button>
      </div>
    </CreateStepShell>
  );
}
