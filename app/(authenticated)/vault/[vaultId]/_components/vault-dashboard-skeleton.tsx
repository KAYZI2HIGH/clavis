"use client";

export function VaultDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-paper grain">
      {/* Header skeleton — matches VaultHeader */}
      <header className="border-b hairline-strong bg-paper">
        <div className="max-w-6xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Vault icon placeholder */}
            <div className="w-7 h-7 bg-secondary animate-pulse" />
            <div className="space-y-1">
              {/* Vault name */}
              <div className="h-4 w-32 bg-secondary animate-pulse" />
              {/* Quorum line */}
              <div className="h-3 w-48 bg-secondary/60 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Settings + sign out buttons */}
            <div className="h-4 w-16 bg-secondary animate-pulse" />
            <div className="h-4 w-16 bg-secondary animate-pulse" />
          </div>
        </div>
        {/* Balance section skeleton */}
        <div className="max-w-6xl mx-auto px-8 py-10">
          <div className="h-3 w-24 bg-secondary/60 animate-pulse mb-3" />
          <div className="h-12 w-64 bg-secondary animate-pulse" />
          {/* Funding account */}
          <div className="mt-6 pt-6 border-t hairline flex items-center gap-4">
            <div className="space-y-1">
              <div className="h-3 w-28 bg-secondary/60 animate-pulse" />
              <div className="h-4 w-40 bg-secondary animate-pulse" />
            </div>
            <div className="h-4 w-16 bg-secondary/60 animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main content skeleton */}
      <main className="max-w-6xl mx-auto px-8 pb-24">
        {/* Ledger header */}
        <div className="flex items-end justify-between mt-10 mb-5">
          <div className="space-y-1">
            <div className="h-3 w-12 bg-secondary/60 animate-pulse" />
            <div className="h-6 w-32 bg-secondary animate-pulse" />
          </div>
          {/* Request payout button */}
          <div className="h-9 w-36 bg-secondary animate-pulse" />
        </div>

        {/* Transaction list skeleton */}
        <div className="border hairline-strong bg-card">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="px-6 py-5 flex items-center justify-between border-b hairline last:border-0"
            >
              <div className="space-y-1.5">
                <div className="h-4 w-36 bg-secondary animate-pulse" />
                <div className="h-3 w-24 bg-secondary/60 animate-pulse" />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-20 bg-secondary animate-pulse" />
                <div className="h-5 w-16 bg-secondary/60 animate-pulse rounded-sm" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
