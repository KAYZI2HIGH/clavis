"use client";

export function CreateStepSkeleton() {
  return (
    <div className="min-h-screen bg-paper grain flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="h-3 w-24 bg-secondary/60 animate-pulse" />
        <div className="h-8 w-64 bg-secondary animate-pulse" />
        <div className="h-12 w-full bg-secondary/60 animate-pulse" />
        <div className="h-10 w-32 bg-secondary animate-pulse" />
      </div>
    </div>
  );
}
