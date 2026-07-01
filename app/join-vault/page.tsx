import { Suspense } from "react";
import { JoinVaultContent } from "./_components/join-vault-content";

export default function JoinVaultPage() {
  return (
    <Suspense>
      <JoinVaultContent />
    </Suspense>
  );
}
