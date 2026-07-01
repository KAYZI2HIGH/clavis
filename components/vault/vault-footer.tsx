import { QUORUM } from "@/lib/mock-data";

export function VaultFooter() {
  return (
    <footer className="border-t hairline">
      <div className="max-w-6xl mx-auto px-8 py-5 flex items-center justify-between">
        <p className="engraved text-ink-faint">Clavis · Partnership Vault</p>
        <p className="engraved text-ink-faint">
          {QUORUM} of 3 quorum · escrow-grade
        </p>
      </div>
    </footer>
  );
}
