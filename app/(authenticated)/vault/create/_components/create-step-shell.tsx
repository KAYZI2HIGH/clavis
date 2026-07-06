"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { InputStyles } from "@/components/shared/input-styles";
import { Wordmark } from "@/components/shared/wordmark";

export function CreateStepShell({
  step,
  onBack,
  children,
}: {
  step: number;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper grain flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between border-b hairline">
        <div className="flex items-center gap-4">
          <Wordmark size="sm" />
          <p className="engraved text-ink-faint">
            Founding a vault · step {step} of 4
          </p>
        </div>
        <button
          className="engraved text-ink-faint hover:text-ink transition-colors"
          onClick={onBack}
        >
          Back
        </button>
      </header>
      <main className="flex-1 flex items-start justify-center px-8 py-14">
        <div className="max-w-xl w-full">{children}</div>
      </main>
      <InputStyles />
    </div>
  );
}

export function RequireDraft({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Extract vaultId from the URL path: /vault/create/[vaultId]/...
  const segments = pathname.split("/");
  const createIdx = segments.indexOf("create");
  const vaultId = createIdx >= 0 ? segments[createIdx + 1] : undefined;

  useEffect(() => {
    if (!vaultId) router.replace("/home");
  }, [vaultId, router]);

  if (!vaultId) return null;
  return children;
}
