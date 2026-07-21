"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Wordmark } from "@/components/shared/wordmark";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/lib/query-keys";

type InviteData = {
  invite: { id: string; token: string; status: string };
  vault: {
    id: string;
    name: string;
    quorum: number | null;
    status: string;
    stakeholderCount: number;
    stakeholders: { id: string; name: string; email?: string; phone?: string }[];
    investmentTerms: {
      investment_type: string;
      investor_profit_share?: number;
      investor_monthly_fixed?: number;
      investor_return_cap?: number;
      term_duration_months?: number;
    };
    standingOrders: { id: string; plain_language: string; action: string }[];
  };
  inviter: { id: string; name: string; initials: string } | null;
};

export function JoinVaultContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { authedUserId, authedName, authedPhone } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InviteData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const signUpHref = token ? `/sign-up?token=${token}` : "/sign-up";
  const signInHref = token ? `/sign-in?token=${token}` : "/sign-in";

  // Check if current user is already in the vault
  const isAlreadyStakeholder = data
    ? data.vault.stakeholders.some(
        (s) =>
          s.name.toLowerCase() === authedName?.toLowerCase() ||
          (s.phone && authedPhone && s.phone === authedPhone)
      )
    : false;

  // Fetch invite info from DB via API & Poll status if in draft state
  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let active = true;
    let timer: NodeJS.Timeout;

    async function checkInvitation() {
      try {
        const res = await fetch(`/api/invitations?token=${encodeURIComponent(token!)}`);
        if (!res.ok) {
          if (active) setNotFound(true);
          return;
        }
        const json = await res.json();
        if (active) {
          setData(json);
          
          // If vault becomes active and user is already a stakeholder (or just joined), redirect to dashboard
          const userAlreadyJoined = json.vault.stakeholders.some(
            (s: { name: string; phone?: string }) =>
              s.name.toLowerCase() === authedName?.toLowerCase() ||
              (s.phone && authedPhone && s.phone === authedPhone)
          );
          if (json.vault.status === "active" && (submitted || userAlreadyJoined)) {
            router.push(`/vault/${json.vault.id}`);
          }
        }

        // Keep polling every 3s if it is currently a draft
        if (active && json.vault.status === "draft") {
          timer = setTimeout(checkInvitation, 3000);
        }
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    checkInvitation();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [token, submitted, router, authedName, authedPhone]);

  const handleAccept = async () => {
    if (!token || !authedUserId || !authedName || submitting || isAlreadyStakeholder) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: authedName,
          userId: authedUserId,
          phone: authedPhone || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error ?? "Failed to join vault.");
        setSubmitting(false);
        return;
      }
      
      setSubmitted(true);
      toast.success("Joined vault successfully!");

      if (data?.vault.status === "active") {
        qc.invalidateQueries({ queryKey: queryKeys.vaults.all });
        router.push(`/vault/${data.vault.id}`);
      }
    } catch {
      toast.error("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  const handleDecline = () => {
    router.push("/home");
  };

  // Not logged in — show sign up / sign in prompt
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

  return (
    <div className="min-h-screen bg-paper grain flex flex-col">
      <header className="px-8 py-6">
        <Wordmark size="sm" />
      </header>
      <main className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-md w-full">
          <p className="engraved">Invitation</p>
          <h1 className="serif text-2xl text-ink mt-2">
            {loading ? "Loading…" : data?.vault.name ?? "A partnership vault"}
          </h1>
          <p className="text-sm text-ink-muted mt-2">
            {loading
              ? "Looking up your invitation…"
              : notFound
                ? "This invitation could not be found or has expired."
                : isAlreadyStakeholder
                  ? data?.vault.status === "draft"
                    ? "You are already a partner in this vault! Please wait for the founder to complete setup and launch the vault."
                    : "You are already a partner in this vault."
                  : submitted && data?.vault.status === "draft"
                    ? "You have successfully joined the vault! Please wait for the founder to complete setup and launch the vault."
                    : data?.inviter
                      ? `${data.inviter.name} has invited you to join this partnership vault.`
                      : "You've been invited to join this partnership vault."}
          </p>

          {!loading && !notFound && data && (
            <div className="mt-8 border hairline-strong bg-card">
              {data.vault.quorum !== null && (
                <div className="px-5 py-4 border-b hairline">
                  <p className="engraved">Quorum rule</p>
                  <p className="text-sm text-ink mt-1">
                    Requires {data.vault.quorum} of {data.vault.stakeholderCount} keys to approve any payout.
                  </p>
                </div>
              )}
              
              {data.vault.investmentTerms && data.vault.investmentTerms.investment_type && (
                <div className="px-5 py-4 border-b hairline">
                  <p className="engraved">Investment terms</p>
                  <p className="text-sm text-ink mt-1">
                    {data.vault.investmentTerms.investment_type === "profit_share" && (
                      `Profit Share: ${data.vault.investmentTerms.investor_profit_share}% of net revenue pool`
                    )}
                    {data.vault.investmentTerms.investment_type === "fixed_return" && (
                      `Fixed Return: ${data.vault.investmentTerms.investor_monthly_fixed} per month`
                    )}
                    {data.vault.investmentTerms.investment_type === "hybrid" && (
                      `Hybrid: ${data.vault.investmentTerms.investor_profit_share}% profit share + ${data.vault.investmentTerms.investor_monthly_fixed} fixed`
                    )}
                    {data.vault.investmentTerms.investor_return_cap ? ` (Capped at ${data.vault.investmentTerms.investor_return_cap}x)` : ''}
                  </p>
                </div>
              )}

              {data.vault.standingOrders && data.vault.standingOrders.length > 0 && (
                <div className="px-5 py-4 border-b hairline">
                  <p className="engraved mb-2">Automated standing orders</p>
                  <ul className="space-y-2">
                    {data.vault.standingOrders.map((so) => (
                      <li key={so.id} className="text-sm text-ink flex items-start gap-2">
                        <span className="text-ink-muted mt-0.5">•</span>
                        <span>
                          {so.plain_language}
                          <span className="ml-2 text-[10px] font-bold tracking-wider px-1.5 py-0.5 border hairline bg-secondary/30 whitespace-nowrap">
                            {so.action.replace(/_/g, " ").toUpperCase()}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.vault.status === "draft" && (
                <div className="px-5 py-4 border-b hairline">
                  <p className="text-xs text-ink-muted">
                    This vault is still being set up by the founder.
                  </p>
                </div>
              )}
              <div className="px-5 py-4">
                <p className="engraved">Reference</p>
                <p className="mono text-sm text-ink mt-1">{token ?? "—"}</p>
              </div>
            </div>
          )}

          {!submitted && !isAlreadyStakeholder ? (
            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                className="btn-mech btn-mech-danger flex-1"
                onClick={handleDecline}
                disabled={submitting}
              >
                Decline
              </button>
              <button
                className="btn-mech btn-mech-primary flex-1 disabled:opacity-40"
                onClick={handleAccept}
                disabled={!data || notFound || submitting || loading}
              >
                {submitting ? "Joining…" : "Join Vault"}
              </button>
            </div>
          ) : (
            (submitted || isAlreadyStakeholder) && data?.vault.status === "draft" && (
              <div className="mt-8 p-4 bg-secondary text-center border hairline-strong text-ink text-sm">
                ⏳ Waiting for founder to launch vault…
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
