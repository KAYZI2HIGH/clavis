"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { KeyIcon } from "@/components/shared/key-icon";
import { makeInitials } from "@/lib/vault-utils";
import { CreateStepShell } from "@/app/(authenticated)/vault/create/_components/create-step-shell";
import { useVaultQuery } from "@/hooks/use-vault-query";
import { CreateStepSkeleton } from "@/components/vault/create-step-skeleton";
import type { Stakeholder } from "@/lib/types";

function CreateInviteContent({ vaultId }: { vaultId: string }) {
  const router = useRouter();
  const { data: vault, isLoading } = useVaultQuery(vaultId, { refetchInterval: 3000 });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [emailList, setEmailList] = useState<{ id: string; name: string; email: string; initials: string }[]>([]);
  const [addingEmail, setAddingEmail] = useState(false);

  if (isLoading || !vault) {
    return <CreateStepSkeleton />;
  }

  const method = vault.quorum !== undefined ? "link" : "email"; // Fallback/logic placeholder
  const token = vault.linkInvitations?.[0]?.token ?? "";
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join-vault?token=${token}`
      : `/join-vault?token=${token}`;

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
    sessionStorage.setItem("draft_email_invites", JSON.stringify(emailList));
    router.push(`/vault/create/${vaultId}/quorum`);
  };

  return (
    <CreateStepShell step={2} onBack={() => router.push("/vault/create/name")}>
      <p className="engraved">Stakeholders</p>
      <h1 className="serif text-3xl text-ink mt-2 leading-tight">
        Who holds a key to this vault?
      </h1>

      {method === "link" ? (
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

          <div className="mt-6">
            <p className="engraved mb-3">
              Key-holders
              {vault.stakeholders && vault.stakeholders.length > 0 && (
                <span className="ml-2 text-brass-deep">· {vault.stakeholders.length} joined</span>
              )}
            </p>
            <div className="border hairline-strong bg-card divide-y hairline">
              {vault.stakeholders?.map((sh: Stakeholder) => (
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
              {vault.stakeholders?.filter((sh: Stakeholder) => sh.isFounder).map((sh: Stakeholder) => (
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
                    <p className="text-xs text-ink-muted">{inv.email}</p>
                  </div>
                  <button
                    className="engraved text-ink-faint hover:text-crimson transition-colors"
                    onClick={() => removeEmailInvite(inv.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-12 flex justify-end">
        <button
          className="btn-mech btn-mech-ghost"
          onClick={handleContinue}
        >
          Continue
        </button>
      </div>
    </CreateStepShell>
  );
}

export default function CreateInvitePage({
  params,
}: {
  params: Promise<{ vaultId: string }>;
}) {
  const { vaultId } = use(params);
  return <CreateInviteContent vaultId={vaultId} />;
}
