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
  const [method, setMethod] = useState<"link" | "email">("link");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length > 0;

  const handleContinue = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError(null);

    const vaultId = makeId("v");

    // Optimistically seed React Query cache
    qc.setQueryData(queryKeys.vaults.detail(vaultId), {
      id: vaultId,
      name: name.trim(),
      quorum: 2,
      status: "draft",
      balance_kobo: 0,
      funding_account: "",
      stakeholders: [{
        id: makeId("sh"),
        name: session?.user?.name ?? "You",
        email: session?.user?.email ?? "",
        initials: makeInitials(session?.user?.name ?? "You"),
        is_founder: true,
        vault_id: vaultId,
      }],
      transactions: [],
      linkInvitations: [],
      emailInvites: [],
      pendingJoins: [],
      youId: "",
      founderId: "",
    });

    // Navigate immediately
    router.push(`/vault/create/${vaultId}/invite`);

    // Fire API in background
    fetch("/api/vaults/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), vaultId }),
    }).then(async (res) => {
      if (!res.ok) {
        // Rollback
        qc.removeQueries({ 
          queryKey: queryKeys.vaults.detail(vaultId) 
        });
        router.push("/vault/create/name");
        toast.error("Failed to create vault. Try again.");
      } else {
        // Confirm cache with real data
        qc.invalidateQueries({ 
          queryKey: queryKeys.vaults.detail(vaultId) 
        });
      }
    }).catch(() => {
      qc.removeQueries({ 
        queryKey: queryKeys.vaults.detail(vaultId) 
      });
      router.push("/vault/create/name");
      toast.error("Failed to create vault. Try again.");
    });
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleContinue()}
          placeholder="Riverside Holdings"
          disabled={loading}
        />
        <p className="text-sm text-ink-muted mt-3">
          This is the name your partners will see when they&apos;re invited.
        </p>
        {error && <p className="text-sm text-crimson mt-3">{error}</p>}
      </div>

      <div className="mt-8">
        <p className="engraved mb-3">Invite method</p>
        <div className="inline-flex border hairline-strong" style={{ borderRadius: 2 }}>
          {(["link", "email"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              disabled={loading}
              className={`px-4 py-2 text-sm transition-colors ${method === m ? "bg-ink text-paper" : "text-ink-muted hover:text-ink"}`}
            >
              {m === "link" ? "Share a Link" : "Invite by Email"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 flex justify-end">
        <button
          className="btn-mech btn-mech-ghost disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          onClick={handleContinue}
          disabled={!valid || loading}
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          {loading ? "Creating vault…" : "Continue"}
        </button>
      </div>
    </CreateStepShell>
  );
}
