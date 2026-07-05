"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { InputStyles } from "@/components/shared/input-styles";
import { KeyIcon } from "@/components/shared/key-icon";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { PendingJoin, Vault } from "@/lib/types";
import { toast } from "sonner";
import { makeId } from "@/lib/vault-utils";

interface SettingsDialogProps {
  vault: Vault;
  vaultId: string;
  open: boolean;
  onOpenChange: (b: boolean) => void;
}

function QuorumEditor({ vault, vaultId }: { vault: Vault; vaultId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(vault.quorum);
  const [confirm, setConfirm] = useState(false);
  const total = vault.stakeholders.length;

  useEffect(() => {
    setDraft(vault.quorum);
  }, [vault.quorum]);

  const dirty = draft !== vault.quorum;

  const handleUpdateQuorum = async (newQuorum: number) => {
    // Optimistic Update
    qc.setQueryData(
      queryKeys.vaults.detail(vaultId),
      (old: Vault | undefined) => 
        old ? { ...old, quorum: newQuorum } : old
    );

    try {
      const res = await fetch(`/api/vaults/${vaultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quorum: newQuorum }),
      });
      if (!res.ok) throw new Error();
      qc.invalidateQueries({ queryKey: queryKeys.vaults.detail(vaultId) });
      toast.success(`Quorum updated to ${newQuorum} keys.`);
    } catch {
      qc.invalidateQueries({ queryKey: queryKeys.vaults.detail(vaultId) });
      toast.error("Failed to update quorum threshold.");
    }
  };

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
                  handleUpdateQuorum(draft);
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

function PendingJoinRow({ pj, vaultId }: { pj: PendingJoin; vaultId: string }) {
  const qc = useQueryClient();

  const handleAction = async (action: "approve" | "reject") => {
    try {
      const res = await fetch(`/api/vaults/${vaultId}/joins/${pj.id}/${action}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      qc.invalidateQueries({ queryKey: queryKeys.vaults.detail(vaultId) });
      toast.success(action === "approve" ? "Stakeholder added." : "Join request rejected.");
    } catch {
      toast.error("Failed to approve join request.");
    }
  };

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
        onClick={() => handleAction("reject")}
      >
        Reject
      </button>
      <button
        className="btn-mech btn-mech-primary"
        onClick={() => handleAction("approve")}
      >
        Confirm
      </button>
    </div>
  );
}

function SettingsInvite({ vault, vaultId }: { vault: Vault; vaultId: string }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<"link" | "email">("link");
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const activeLinkToken = vault.linkInvitations?.find((li) => li.status === "pending")?.token;

  const inviteUrl = activeLinkToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join-vault?token=${activeLinkToken}`
    : "";

  const gen = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vaults/${vaultId}/invites/link`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      qc.invalidateQueries({ queryKey: queryKeys.vaults.detail(vaultId) });
      toast.success("Invitation link generated.");
    } catch {
      toast.error("Failed to generate invitation link.");
    } finally {
      setLoading(false);
    }
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

  const add = async () => {
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/vaults/${vaultId}/invites/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      if (!res.ok) throw new Error();
      qc.invalidateQueries({ queryKey: queryKeys.vaults.detail(vaultId) });
      toast.success("Invitation emailed.");
      setName("");
      setEmail("");
    } catch {
      toast.error("Failed to send invitation email.");
    } finally {
      setLoading(false);
    }
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
          {activeLinkToken ? (
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
            <button className="btn-mech btn-mech-ghost w-full" onClick={gen} disabled={loading}>
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
            disabled={loading}
          />
          <input
            className="input-mech"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@partner.co"
            disabled={loading}
          />
          <div className="flex justify-end">
            <button
              className="btn-mech btn-mech-ghost"
              onClick={add}
              disabled={!name.trim() || !email.trim() || loading}
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
              <PendingJoinRow key={pj.id} pj={pj} vaultId={vaultId} />
            ))}
          </div>
        </div>
      )}
      {vault.linkInvitations && vault.linkInvitations.length > 0 && (
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
      {vault.emailInvites && vault.emailInvites.length > 0 && (
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
  vaultId,
  open,
  onOpenChange,
}: SettingsDialogProps) {
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
          <QuorumEditor vault={vault} vaultId={vaultId} />
          <SettingsInvite vault={vault} vaultId={vaultId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
