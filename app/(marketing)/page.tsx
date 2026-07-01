import Link from "next/link";
import { MarketingShell } from "@/components/layouts/marketing-shell";
import { Wordmark } from "@/components/shared/wordmark";

export default function WelcomePage() {
  return (
    <MarketingShell>
      <div className="max-w-md w-full text-center">
        <Wordmark size="lg" />
        <p className="serif text-xl text-ink-muted mt-6 leading-relaxed">
          A vault that opens only when its partners agree.
        </p>
        <div className="mt-14 space-y-3">
          <Link href="/sign-up" className="btn-mech btn-mech-primary w-full">
            Create an account
          </Link>
          <Link href="/sign-in" className="btn-mech btn-mech-ghost w-full">
            Sign in
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
