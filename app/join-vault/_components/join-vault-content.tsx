"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Wordmark } from "@/components/shared/wordmark";
import { useAuth } from "@/hooks/use-auth";
import { usePartnerById } from "@/hooks/use-member";
import { useVault } from "@/hooks/use-vault";

export function JoinVaultContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { authedUserId } = useAuth();
  const { state, acceptInvite, declineInvite } = useVault();
  const router = useRouter();
  const partnerById = usePartnerById();

  const inv = state.invitations.find((i) => i.token === token);
  const inviter = inv ? partnerById(inv.invitedBy) : undefined;

  const signUpHref = token ? `/sign-up?token=${token}` : "/sign-up";
  const signInHref = token ? `/sign-in?token=${token}` : "/sign-in";

  if (!authedUserId) {
    return (
      <div className="min-h-screen bg-paper grain flex flex-col">
        <header className="px-8 py-6">
          <Wordmark size="sm" />
        </header>
        <main className="flex-1 flex items-center justify-center px-8">
          <div className="max-w-sm w-full text-center">
            <p className="engraved mb-3">Invitation</p>
            <h1 className="serif text-2xl text-ink">
              You&apos;ve been invited to a vault
            </h1>
            <p className="text-sm text-ink-muted mt-3">
              Create an account or sign in to review the invitation.
            </p>
            <div className="mt-10 space-y-3">
              <Link href={signUpHref} className="btn-mech btn-mech-primary w-full">
                Create an account
              </Link>
              <Link href={signInHref} className="btn-mech btn-mech-ghost w-full">
                Sign in
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const handleAccept = () => {
    if (!token) return;
    acceptInvite(token);
    router.push("/vault");
  };

  const handleDecline = () => {
    if (!token) return;
    declineInvite(token);
    router.push("/vault");
  };

  return (
    <div className="min-h-screen bg-paper grain flex flex-col">
      <header className="px-8 py-6">
        <Wordmark size="sm" />
      </header>
      <main className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-md w-full">
          <p className="engraved">Invitation</p>
          <h1 className="serif text-2xl text-ink mt-2">
            Halverson, Ortega &amp; Reeve
          </h1>
          <p className="text-sm text-ink-muted mt-2">
            {inviter
              ? `${inviter.name} has invited you to join this partnership vault.`
              : "You've been invited to join this partnership vault."}
          </p>

          <div className="mt-8 border hairline-strong bg-card">
            <div className="px-5 py-4 border-b hairline">
              <p className="engraved">Quorum rule</p>
              <p className="text-sm text-ink mt-1">
                This vault requires 2 of 3 keys to approve any payout.
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="engraved">Reference</p>
              <p className="mono text-sm text-ink mt-1">{token ?? "—"}</p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              className="btn-mech btn-mech-danger flex-1"
              onClick={handleDecline}
            >
              Decline
            </button>
            <button
              className="btn-mech btn-mech-primary flex-1"
              onClick={handleAccept}
            >
              Accept and Join
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
