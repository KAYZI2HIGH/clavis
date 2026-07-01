"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { InputStyles } from "@/components/shared/input-styles";
import { KeyIcon } from "@/components/shared/key-icon";
import { useVault } from "@/hooks/use-vault";
import type { PendingJoin, Vault } from "@/lib/types";

function QuorumEditor({ vault }: { vault: Vault }) {
  const { setQuorum } = useVault();
  const [draft, setDraft] = useState(vault.quorum);
  const [confirm, setConfirm] = useState(false);
  const total = vault.stakeholders.length;

  useEffect(() => {
    setDraft(vault.quorum);
  }, [vault.quorum]);

  const dirty = draft !== vault.quorum;

  return (
    <div>
      <p className="engraved mb-3">Approval threshold</p>
      <div className="border hairline-strong bg-card p-5">
        <div className="flex items-center justify-center gap-3">
          {Array.from({ length: total }).map((_, i) => (
            <KeyIcon key={i} filled={i < draft} size={26} />
          ))}
        </div>
        <div className="mt-5 flex items-center justify-center gap-4">
          <button
            className="btn-mech btn-mech-ghost"
            onClick={() => setDraft(Math.max(1, draft - 1))}
            disabled={draft <= 1 || confirm}
          >
            −
          </button>
          <p
            className="serif text-2xl text-ink mono"
            style={{ minWidth: 72, textAlign: "center" }}
          >
            {draft} <span className="text-ink-faint text-lg">of {total}</span>
          </p>
          <button
            className="btn-mech btn-mech-ghost"
            onClick={() => setDraft(Math.min(total, draft + 1))}
            disabled={draft >= total || confirm}
          >
            +
          </button>
        </div>
        <p className="text-center text-sm text-ink-muted mt-4">
          Any {draft} of {total} partners must approve before a payout is sent.
        </p>
        {dirty && !confirm && (
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              className="btn-mech btn-mech-ghost"
              onClick={() => setDraft(vault.quorum)}
            >
              Cancel
            </button>
            <button
              className="btn-mech btn-mech-primary"
              onClick={() => setConfirm(true)}
            >
              Update to {draft} of {total} keys
            </button>
          </div>
        )}
        {confirm && (
          <div className="mt-5 border hairline-strong p-3 bg-paper flex items-center justify-between">
            <p className="text-sm text-ink">
              Update quorum to {draft} of {total} keys?
            </p>
            <div className="flex gap-2">
              <button
                className="btn-mech btn-mech-ghost"
                onClick={() => {
                  setDraft(vault.quorum);
                  setConfirm(false);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-mech btn-mech-primary"
                onClick={() => {
                  setQuorum(draft);
                  setConfirm(false);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-ink-faint mt-2">
        Applies to payouts requested after the change.
      </p>
    </div>
  );
}

function PendingJoinRow({ pj }: { pj: PendingJoin }) {
  const { confirmPendingJoin, rejectPendingJoin } = useVault();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className="w-7 h-7 border hairline-strong flex items-center justify-center mono text-[10px] text-ink"
        style={{ borderRadius: 999 }}
      >
        {pj.initials}
      </div>
      <div className="flex-1">
        <p className="text-sm text-ink">{pj.name}</p>
        <p className="engraved text-ink-faint">via {pj.viaToken}</p>
      </div>
      <button
        className="engraved text-ink-faint hover:text-crimson transition-colors"
        onClick={() => rejectPendingJoin(pj.id)}
      >
        Reject
      </button>
      <button
        className="btn-mech btn-mech-primary"
        onClick={() => confirmPendingJoin(pj.id)}
      >
        Confirm
      </button>
    </div>
  );
}

function SettingsInvite({ vault }: { vault: Vault }) {
  const { createLinkInvitation, addEmailInviteToActive } = useVault();
  const [method, setMethod] = useState<"link" | "email">("link");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const inviteUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join-vault?token=${token}`
    : "";

  const gen = () => {
    const inv = createLinkInvitation();
    setToken(inv.token);
  };

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
    addEmailInviteToActive(name.trim(), email.trim());
    setName("");
    setEmail("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="engraved">Invite</p>
        <div
          className="inline-flex border hairline-strong"
          style={{ borderRadius: 2 }}
        >
          {(["link", "email"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`px-3 py-1 text-xs transition-colors ${
                method === m
                  ? "bg-ink text-paper"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {m === "link" ? "Share a Link" : "By Email"}
            </button>
          ))}
        </div>
      </div>
      {method === "link" ? (
        <div className="border hairline-strong bg-card p-4">
          {token ? (
            <>
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
              <p className="text-xs text-ink-muted mt-3">
                Anyone with this link can request to join. Confirm them below
                before they hold a key.
              </p>
            </>
          ) : (
            <button className="btn-mech btn-mech-ghost w-full" onClick={gen}>
              Generate Invite Link
            </button>
          )}
        </div>
      ) : (
        <div className="border hairline-strong bg-card p-4 space-y-3">
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
          <div className="flex justify-end">
            <button
              className="btn-mech btn-mech-ghost"
              onClick={add}
              disabled={!name.trim() || !email.trim()}
            >
              Add Key-holder
            </button>
          </div>
        </div>
      )}
      {vault.pendingJoins.length > 0 && (
        <div className="mt-5">
          <p className="engraved mb-2">Pending approval to join</p>
          <div className="border hairline-strong bg-card divide-y hairline">
            {vault.pendingJoins.map((pj) => (
              <PendingJoinRow key={pj.id} pj={pj} />
            ))}
          </div>
        </div>
      )}
      {vault.linkInvitations.length > 0 && (
        <div className="mt-5">
          <p className="engraved mb-2">Open invite links</p>
          <div className="border hairline-strong bg-card divide-y hairline">
            {vault.linkInvitations.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <p className="mono text-xs text-ink">{i.token}</p>
                <span
                  className="engraved px-1.5 py-0.5 border text-ink-muted border-rule-strong"
                  style={{ borderRadius: 1 }}
                >
                  Open
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {vault.emailInvites.length > 0 && (
        <div className="mt-5">
          <p className="engraved mb-2">Emailed invitations</p>
          <div className="border hairline-strong bg-card divide-y hairline">
            {vault.emailInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm text-ink">{inv.name}</p>
                  <p className="engraved text-ink-faint">{inv.email}</p>
                </div>
                <span
                  className="engraved px-1.5 py-0.5 border text-ink-muted border-rule-strong"
                  style={{ borderRadius: 1 }}
                >
                  Awaiting response
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <InputStyles />
    </div>
  );
}

export function SettingsDialog({
  vault,
  open,
  onOpenChange,
}: {
  vault: Vault;
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const { resetDemo } = useVault();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-paper border hairline-strong sm:max-w-lg p-0 max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: 3 }}
      >
        <div className="px-6 py-5 border-b hairline">
          <p className="engraved">Vault settings</p>
          <h3 className="serif text-xl text-ink mt-1 font-normal">{vault.name}</h3>
        </div>
        <div className="px-6 py-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="engraved">Stakeholders</p>
              <p className="engraved text-ink-faint">
                {vault.quorum} of {vault.stakeholders.length} quorum
              </p>
            </div>
            <div className="border hairline-strong divide-y hairline">
              {vault.stakeholders.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="w-7 h-7 border hairline-strong flex items-center justify-center mono text-[10px] text-ink"
                    style={{ borderRadius: 999 }}
                  >
                    {m.initials}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-ink">
                      {m.name}
                      {m.isFounder && (
                        <span className="engraved text-ink-faint ml-2">
                          Founder
                        </span>
                      )}
                    </p>
                    {m.email && (
                      <p className="engraved text-ink-faint">{m.email}</p>
                    )}
                  </div>
                  <KeyIcon filled />
                </div>
              ))}
            </div>
          </div>
          <QuorumEditor vault={vault} />
          <SettingsInvite vault={vault} />
          <div className="border-t hairline pt-5">
            <button
              className="engraved text-ink-faint hover:text-crimson transition-colors"
              onClick={() => {
                resetDemo();
                onOpenChange(false);
              }}
            >
              Reset demo data
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
