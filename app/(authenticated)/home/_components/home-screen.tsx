"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InputStyles } from "@/components/shared/input-styles";
import { KeyIcon } from "@/components/shared/key-icon";
import { Wordmark } from "@/components/shared/wordmark";
import { useAuth } from "@/hooks/use-auth";
import { useVault } from "@/hooks/use-vault";

export function HomeScreen() {
  const { state, openVault, startDraft } = useVault();
  const { authedName, signOut } = useAuth();
  const router = useRouter();
  const [pasted, setPasted] = useState("");

  const submitPaste = () => {
    const m =
      pasted.match(/join=([A-Z0-9]+)/i) ||
      pasted.match(/[?&]token=([A-Z0-9]+)/i);
    if (!m) return;
    router.push(`/join-vault?token=${m[1]}`);
  };

  const handleSignOut = () => {
    signOut();
    router.push("/");
  };

  const handleCreateVault = () => {
    startDraft(authedName || "You");
    router.push("/vault/create/name");
  };

  const handleOpenVault = (id: string) => {
    openVault(id);
    router.push("/vault");
  };

  return (
    <div className="min-h-screen bg-paper grain flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between border-b hairline">
        <Wordmark size="sm" />
        <div className="flex items-center gap-4">
          <p className="engraved text-ink-faint">
            Signed in as {authedName || "you"}
          </p>
          <button
            className="engraved text-ink-faint hover:text-ink transition-colors"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 flex items-start justify-center px-8 py-16">
        <div className="max-w-2xl w-full">
          <p className="engraved">Your vaults</p>
          <h1 className="serif text-3xl text-ink mt-2 leading-tight">
            Which vault would you like to open?
          </h1>
          <div className="mt-10">
            {state.vaults.length === 0 ? (
              <div className="border hairline-strong bg-card px-6 py-8 text-center">
                <p className="text-sm text-ink-muted">
                  You don&apos;t hold a key to any vault yet.
                </p>
              </div>
            ) : (
              <div className="border hairline-strong bg-card divide-y hairline">
                {state.vaults.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleOpenVault(v.id)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-secondary/60 transition-colors"
                  >
                    <div>
                      <p className="serif text-xl text-ink">{v.name}</p>
                      <p className="engraved mt-1">
                        Requires {v.quorum} of {v.stakeholders.length} keys
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {v.stakeholders.map((s) => (
                        <KeyIcon key={s.id} filled />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border hairline-strong bg-card p-5">
              <p className="engraved">Found a new vault</p>
              <p className="serif text-lg text-ink mt-1 leading-snug">
                Start one as the founding partner.
              </p>
              <button
                className="btn-mech btn-mech-ghost w-full mt-4"
                onClick={handleCreateVault}
              >
                Create a Vault
              </button>
            </div>
            <div className="border hairline-strong bg-card p-5">
              <p className="engraved">Have an invite link?</p>
              <p className="serif text-lg text-ink mt-1 leading-snug">
                Paste it to review the invitation.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  className="input-mech mono flex-1"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder="…/join-vault?token=ABCD1234"
                />
                <button
                  className="btn-mech btn-mech-ghost"
                  onClick={submitPaste}
                  disabled={!pasted.trim()}
                >
                  Open
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <InputStyles />
    </div>
  );
}
