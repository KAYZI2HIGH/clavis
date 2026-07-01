import type { Vault } from "@/lib/types";

export function VaultFooter({ vault }: { vault: Vault }) {
  return (
    <footer className="border-t hairline">
      <div className="max-w-6xl mx-auto px-8 py-5 flex items-center justify-between">
        <p className="engraved text-ink-faint">Clavis · Partnership Vault</p>
        <p className="engraved text-ink-faint">
          {vault.quorum} of {vault.stakeholders.length} quorum · escrow-grade
        </p>
      </div>
    </footer>
  );
}
