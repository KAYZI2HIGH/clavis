"use client";

import { useReconciliationQuery } from "@/hooks/use-reconciliation-query";
import { formatDistanceToNow } from "date-fns";

export function ReconciliationBanner({ 
  vaultId 
}: { 
  vaultId: string 
}) {
  const { data: log, isLoading } = useReconciliationQuery(vaultId);

  if (isLoading || !log) return null;

  const runAt = formatDistanceToNow(new Date(log.run_at), { 
    addSuffix: true 
  });

  // Build ticker message
  const messages: string[] = [];

  if (log.status === "clean") {
    messages.push("No discrepancies found");
  }

  log.resolved?.forEach((r: string) => messages.push(r));
  log.orphans_credited?.forEach((r: string) => messages.push(r));
  log.critical?.forEach((r: string) => 
    messages.push(`⚠ ${r}`)
  );

  // Duplicate messages for seamless loop
  const ticker = [...messages, ...messages].join(
    "   ·   "
  );

  const bannerColor =
    log.status === "critical"
      ? "bg-crimson/10 border-crimson/30 text-crimson"
      : log.status === "resolved"
        ? "bg-brass/10 border-brass/30 text-brass"
        : "bg-secondary border-b hairline text-ink-muted";

  return (
    <div className={`w-full border-b overflow-hidden ${bannerColor}`}>
      <div className="max-w-6xl mx-auto px-8 py-2 flex items-center gap-4">
        <span className="engraved shrink-0 text-xs">
          RECONCILED {runAt.toUpperCase()}
        </span>
        <div className="flex-1 overflow-hidden relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-paper to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-paper to-transparent z-10" />
          {/* Scrolling ticker */}
          <div
            className="whitespace-nowrap text-xs animate-marquee"
            style={{
              display: "inline-block",
            }}
          >
            {ticker}
          </div>
        </div>
      </div>
    </div>
  );
}
