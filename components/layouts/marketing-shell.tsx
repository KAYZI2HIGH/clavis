import Link from "next/link";
import { Wordmark } from "@/components/shared/wordmark";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper grain flex flex-col">
      <header className="sticky top-0 z-50 bg-paper/95 backdrop-blur-sm border-b hairline">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <Link href="/">
            <Wordmark size="sm" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="btn-mech btn-mech-ghost text-xs sm:text-sm">
              Sign In
            </Link>
            <Link href="/sign-up" className="btn-mech btn-mech-primary text-xs sm:text-sm">
              Sign Up
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t hairline">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-5">
          <p className="engraved text-ink-faint text-center text-xs">
            © 2026 Clavis · Built for the Nomba x DevCareer Hackathon
          </p>
        </div>
      </footer>
    </div>
  );
}