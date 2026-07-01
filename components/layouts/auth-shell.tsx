import Link from "next/link";
import { Wordmark } from "@/components/shared/wordmark";

export function AuthShell({
  backHref = "/",
  children,
}: {
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper grain flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between">
        <Wordmark size="sm" />
        <Link
          href={backHref}
          className="engraved text-ink-faint hover:text-ink transition-colors"
        >
          Back
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-8">
        {children}
      </main>
    </div>
  );
}
