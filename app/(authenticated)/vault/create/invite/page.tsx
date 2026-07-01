"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyIcon } from "@/components/shared/key-icon";
import { useVault } from "@/hooks/use-vault";
import {
  CreateStepShell,
  RequireDraft,
} from "../_components/create-step-shell";

function CreateInviteContent() {
  const {
    state,
    setDraftMethod,
    addDraftStakeholder,
    removeDraftStakeholder,
    setDraftQuorum,
  } = useVault();
  const router = useRouter();
  const draft = state.draft!;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const token = draft.linkToken ?? "";
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join-vault?token=${token}`
      : `/join-vault?token=${token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const add = () => {
    if (!name.trim() || !email.trim()) return;
    addDraftStakeholder(name, email);
    setName("");
    setEmail("");
    const next = draft.stakeholders.length + 1;
    if (draft.quorum > next) setDraftQuorum(next);
  };

  return (
    <CreateStepShell
      step={3}
      onBack={() => router.push("/vault/create/quorum")}
    >
      <p className="engraved">Stakeholders</p>
      <h1 className="serif text-3xl text-ink mt-2 leading-tight">
        Who holds a key to this vault?
      </h1>
      <div
        className="mt-8 inline-flex border hairline-strong"
        style={{ borderRadius: 2 }}
      >
        {(["link", "email"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setDraftMethod(m)}
            className={`px-4 py-2 text-sm transition-colors ${
              draft.method === m
                ? "bg-ink text-paper"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {m === "link" ? "Share a Link" : "Invite by Email"}
          </button>
        ))}
      </div>
      {draft.method === "link" ? (
        <div className="mt-8 space-y-5">
          <div>
            <p className="engraved mb-2">Invitation link</p>
            <div
              className="mono text-xs text-ink bg-secondary border hairline-strong px-3 py-2.5 break-all"
              style={{ borderRadius: 2 }}
            >
              {inviteUrl}
            </div>
            <div className="mt-3 flex justify-end">
              <button className="btn-mech btn-mech-ghost" onClick={copy}>
                {copied ? "Copied" : "Copy Link"}
              </button>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            Anyone with this link can request to join. You&apos;ll still need to
            confirm them before they hold a key.
          </p>
        </div>
      ) : (
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
            />
            <button
              className="btn-mech btn-mech-ghost"
              onClick={add}
              disabled={!name.trim() || !email.trim()}
            >
              Add
            </button>
          </div>
        </div>
      )}
      <div className="mt-10">
        <p className="engraved mb-3">Key-holders</p>
        <div className="border hairline-strong bg-card divide-y hairline">
          {draft.stakeholders.map((sh) => (
            <div key={sh.id} className="flex items-center gap-3 px-4 py-3">
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
              <KeyIcon outlined />
              {!sh.isFounder && (
                <button
                  className="engraved text-ink-faint hover:text-crimson transition-colors ml-2"
                  onClick={() => removeDraftStakeholder(sh.id)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
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

export default function CreateInvitePage() {
  return (
    <RequireDraft>
      <CreateInviteContent />
    </RequireDraft>
  );
}
