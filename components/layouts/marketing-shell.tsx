import { Wordmark } from "@/components/shared/wordmark";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper grain flex flex-col">
      <header className="px-8 py-6">
        <Wordmark size="sm" />
      </header>
      <main className="flex-1 flex items-center justify-center px-8">
        {children}
      </main>
      <footer className="px-8 py-5 border-t hairline">
        <p className="engraved text-ink-faint text-center">
          Multi-key partnership escrow
        </p>
      </footer>
    </div>
  );
}
