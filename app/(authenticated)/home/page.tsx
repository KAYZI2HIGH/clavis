import { Suspense } from "react";
import { HomeScreen } from "./_components/home-screen";
import { VaultListSkeleton } from "@/components/vault/vault-list-skeleton";

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-paper grain flex flex-col">
        <div className="px-8 py-6 border-b hairline">
          <div className="h-5 w-20 bg-secondary animate-pulse" />
        </div>
        <main className="flex-1 flex items-start justify-center px-8 py-16">
          <div className="max-w-2xl w-full">
            <div className="h-3 w-20 bg-secondary/60 animate-pulse mb-2" />
            <div className="h-8 w-72 bg-secondary animate-pulse mb-10" />
            <VaultListSkeleton />
          </div>
        </main>
      </div>
    }>
      <HomeScreen />
    </Suspense>
  );
}
