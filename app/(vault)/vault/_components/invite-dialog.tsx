"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { InputStyles } from "@/components/shared/input-styles";
import { useVault } from "@/hooks/use-vault";

export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const { createInvite } = useVault();
  const [placeholder, setPlaceholder] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setPlaceholder("");
      setToken(null);
      setCopied(false);
    }
  }, [open]);

  const handleGenerate = () => {
    const inv = createInvite(placeholder.trim() || "New partner");
    setToken(inv.token);
  };

  const inviteUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join-vault?token=${token}`
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-paper border hairline-strong sm:max-w-md p-0"
        style={{ borderRadius: 3 }}
      >
        <div className="px-6 py-5 border-b hairline">
          <p className="engraved">Invite</p>
          <h3 className="serif text-xl text-ink mt-1 font-normal">
            Invite a Partner
          </h3>
        </div>

        <div className="px-6 py-5 space-y-5">
          {!token ? (
            <Field label="Name or phone" hint="For your records">
              <input
                autoFocus
                className="input-mech"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                placeholder="J. Marsh · +1 555 0190"
              />
            </Field>
          ) : (
            <>
              <div>
                <p className="engraved mb-2">Invitation link</p>
                <div
                  className="mono text-xs text-ink bg-secondary border hairline-strong px-3 py-2.5 break-all"
                  style={{ borderRadius: 2 }}
                >
                  {inviteUrl}
                </div>
              </div>
              <p className="text-xs text-ink-muted">
                Share this link with the partner. They&apos;ll be asked to sign
                in and confirm before joining.
              </p>
            </>
          )}
          <InputStyles />
        </div>

        <div className="px-6 py-4 border-t hairline flex items-center justify-between bg-card">
          <button
            className="btn-mech btn-mech-ghost"
            onClick={() => onOpenChange(false)}
          >
            Close
          </button>
          {token ? (
            <button className="btn-mech btn-mech-primary" onClick={copy}>
              {copied ? "Copied" : "Copy Link"}
            </button>
          ) : (
            <button
              className="btn-mech btn-mech-primary"
              onClick={handleGenerate}
            >
              Generate Link
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
