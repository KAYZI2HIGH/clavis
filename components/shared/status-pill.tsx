import type { TxStatus } from "@/lib/types";

export function StatusPill({ status }: { status: TxStatus }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: {
      label: "Awaiting keys",
      cls: "text-ink-muted border-rule-strong",
    },
    sealed: { label: "Sealed", cls: "text-brass-deep border-brass" },
    executing: { label: "Executing", cls: "text-brass-deep border-brass" },
    settled: { label: "Settled", cls: "text-ink border-ink" },
    declined: { label: "Declined", cls: "text-crimson border-crimson" },
    failed: { label: "Failed", cls: "text-crimson border-crimson" },
  };
  const s = map[status] ?? { label: status, cls: "text-ink-muted border-rule-strong" };
  return (
    <span
      className={`engraved px-1.5 py-0.5 border ${s.cls}`}
      style={{ borderRadius: 1 }}
    >
      {s.label}
    </span>
  );
}
