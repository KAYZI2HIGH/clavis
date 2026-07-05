"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { KeyIcon } from "@/components/shared/key-icon";
// import { useVault } from "@/hooks/use-vault";
// TODO: Batch 4 - Replace with URL-based draft retrieval state
import { makeInitials } from "@/lib/vault-utils";
import { CreateStepShell, RequireDraft } from "../_components/create-step-shell";

function CreateInviteContent() {
  // const { state } = useVault();
  const state = { draft: { vaultId: "", linkToken: "" } } as any;
  const router = useRouter();
  const draft = state.draft!;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [emailList, setEmailList] = useState<{ id: string; name: string; email: string; initials: string }[]>([]);
  const [addingEmail, setAddingEmail] = useState(false);

  const vaultId = draft.vaultId;
  const token = draft.linkToken ?? "";
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join-vault?token=${token}`
      : `/join-vault?token=${token}`;

  // Live polling — only when method is link and vaultId is set
  const { data: liveData } = useQuery({
    queryKey: ["vault-stakeholders", vaultId],
    queryFn: async () => {
      const res = await fetch(`/api/vaults/${vaultId}/stakeholders`);
      if (!res.ok) throw new Error("Failed to poll stakeholders");
      return res.json() as Promise<{
        stakeholders: { id: string; name: string; initials: string; isFounder?: boolean }[];
        pendingJoins: { id: string; name: string; initials: string }[];
      }>;
    },
    enabled: !!vaultId && draft.method === "link",
    refetchInterval: 3000,
  });

  const liveStakeholders = liveData?.stakeholders ?? [];
  const livePendingJoins = liveData?.pendingJoins ?? [];

  const copy = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const addEmailInvite = async () => {
    if (!name.trim() || !email.trim() || addingEmail) return;
    setAddingEmail(true);
    const initials = makeInitials(name);
    const tempId = `temp-${Date.now()}`;
    setEmailList((prev) => [...prev, { id: tempId, name: name.trim(), email: email.trim(), initials }]);
    setName("");
    setEmail("");
    setAddingEmail(false);
  };

  const removeEmailInvite = (id: string) => {
    setEmailList((prev) => prev.filter((e) => e.id !== id));
  };

  const handleContinue = () => {
    // Store email list in sessionStorage so quorum/review can access it
    sessionStorage.setItem("draft_email_invites", JSON.stringify(emailList));
    router.push("/vault/create/quorum");
  };

  return (
    <CreateStepShell step={2} onBack={() => router.push("/vault/create/name")}>
      <p className="engraved">Stakeholders</p>
      <h1 className="serif text-3xl text-ink mt-2 leading-tight">
        Who holds a key to this vault?
      </h1>

      {draft.method === "link" ? (
        <div className="mt-8 space-y-5">
          <div>
            <p className="engraved mb-2">Invitation link</p>
            <div className="mono text-xs text-ink bg-secondary border hairline-strong px-3 py-2.5 break-all" style={{ borderRadius: 2 }}>
              {inviteUrl}
            </div>
            <div className="mt-3 flex justify-end">
              <button className="btn-mech btn-mech-ghost" onClick={copy}>
                {copied ? "Copied" : "Copy Link"}
              </button>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            Anyone with this link can request to join. You&apos;ll confirm them before they hold a key.
          </p>

          {/* Live stakeholder list */}
          <div className="mt-6">
            <p className="engraved mb-3">
              Key-holders
              {liveStakeholders.length > 0 && (
                <span className="ml-2 text-brass-deep">· {liveStakeholders.length} joined</span>
              )}
            </p>
            <div className="border hairline-strong bg-card divide-y hairline">
              {liveStakeholders.map((sh) => (
                <div key={sh.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 border hairline-strong flex items-center justify-center mono text-[10px] text-ink" style={{ borderRadius: 999 }}>
                    {sh.initials}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-ink">
                      {sh.name} {sh.isFounder && <span className="engraved text-brass-deep ml-1">You</span>}
                    </p>
                  </div>
                  <KeyIcon outlined />
                </div>
              ))}
              {liveStakeholders.length === 0 && (
                <div className="px-4 py-4 text-sm text-ink-faint">
                  Waiting for partners to join via link…
                </div>
              )}
            </div>

          </div>
        </div>
      ) : (
        /* EMAIL MODE */
        <div className="mt-8 space-y-5">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
            <input
              className="input-mech"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
            />
            <input
              className="input-mech"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@partner.co"
              onKeyDown={(e) => e.key === "Enter" && addEmailInvite()}
            />
            <button
              className="btn-mech btn-mech-ghost"
              onClick={addEmailInvite}
              disabled={!name.trim() || !email.trim() || addingEmail}
            >
              Add
            </button>
          </div>

          <div className="mt-6">
            <p className="engraved mb-3">Key-holders</p>
            <div className="border hairline-strong bg-card divide-y hairline">
              {/* Founder is always first */}
              {draft.stakeholders.filter((sh: any) => sh.isFounder).map((sh: any) => (
                <div key={sh.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 border hairline-strong flex items-center justify-center mono text-[10px] text-ink" style={{ borderRadius: 999 }}>
                    {sh.initials}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-ink">
                      {sh.name} <span className="engraved text-brass-deep ml-1">You</span>
                    </p>
                  </div>
                  <KeyIcon outlined />
                </div>
              ))}
              {emailList.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 border hairline-strong flex items-center justify-center mono text-[10px] text-ink" style={{ borderRadius: 999 }}>
                    {inv.initials}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-ink">{inv.name}</p>
                    <p className="engraved text-ink-faint">{inv.email}</p>
                  </div>
                  <KeyIcon outlined />
                  <button
                    className="engraved text-ink-faint hover:text-crimson transition-colors ml-2"
                    onClick={() => removeEmailInvite(inv.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {emailList.length === 0 && (
                <div className="px-4 py-4 text-sm text-ink-faint">
                  Add partners above to invite them.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-12 flex justify-end">
        <button className="btn-mech btn-mech-ghost" onClick={handleContinue}>
          Continue
        </button>
      </div>
    </CreateStepShell>
  );
}

export default function CreateInvitePage() {
  return (
    <RequireDraft>
      <CreateInviteContent />
    </RequireDraft>
  );
}
