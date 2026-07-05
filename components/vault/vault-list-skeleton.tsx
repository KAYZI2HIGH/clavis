"use client";

export function VaultListSkeleton() {
  return (
    <div className="border hairline-strong bg-card divide-y hairline">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="w-full flex items-center justify-between px-6 py-5"
        >
          <div className="space-y-1.5">
            {/* Vault name */}
            <div className="h-5 w-40 bg-secondary animate-pulse" />
            {/* Quorum line */}
            <div className="h-3 w-28 bg-secondary/60 animate-pulse" />
          </div>
          {/* Key icons */}
          <div className="flex items-center gap-1.5">
            {[...Array(3)].map((_, j) => (
              <div
                key={j}
                className="w-4 h-4 bg-secondary/60 animate-pulse"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
