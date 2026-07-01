"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useMembers } from "@/hooks/use-member";
import { useVault } from "@/hooks/use-vault";
import { QUORUM } from "@/lib/mock-data";
import { InviteDialog } from "./invite-dialog";

export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const members = useMembers();
  const { state, resetDemo } = useVault();
  const invitations = state.invitations;
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-paper border-l hairline-strong p-0"
        style={{ borderRadius: 0 }}
      >
        <SheetHeader className="px-6 py-5 border-b hairline text-left">
          <SheetTitle className="serif text-xl text-ink font-normal">
            Vault Settings
          </SheetTitle>
          <SheetDescription className="text-sm text-ink-muted">
            Manage partners and invitations.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="engraved">Partners</p>
              <p className="engraved text-ink-faint">
                {QUORUM} of {members.length} quorum
              </p>
            </div>
            <div className="border hairline-strong divide-y hairline">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="w-7 h-7 border hairline-strong flex items-center justify-center mono text-[10px] text-ink"
                    style={{ borderRadius: 999 }}
                  >
                    {m.initials}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-ink">{m.name}</p>
                    <p className="engraved text-ink-faint">{m.phone}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="engraved">Pending invitations</p>
              <button
                className="btn-mech btn-mech-ghost"
                onClick={() => setInviteOpen(true)}
              >
                Invite a Partner
              </button>
            </div>
            {invitations.length === 0 ? (
              <p className="text-sm text-ink-faint">No invitations sent.</p>
            ) : (
              <div className="border hairline-strong divide-y hairline">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-ink">{inv.placeholder}</p>
                      <p className="mono text-xs text-ink-faint mt-0.5">
                        {inv.token}
                      </p>
                    </div>
                    <span
                      className={`engraved px-1.5 py-0.5 border ${
                        inv.status === "accepted"
                          ? "text-ink border-ink"
                          : inv.status === "declined"
                            ? "text-crimson border-crimson"
                            : "text-ink-muted border-rule-strong"
                      }`}
                      style={{ borderRadius: 1 }}
                    >
                      {inv.status === "pending"
                        ? "Awaiting response"
                        : inv.status === "accepted"
                          ? "Accepted"
                          : "Declined"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

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

        <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      </SheetContent>
    </Sheet>
  );
}
