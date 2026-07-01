"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authedUserId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authedUserId) {
      router.replace("/sign-in");
    }
  }, [authedUserId, router]);

  if (!authedUserId) {
    return null;
  }

  return children;
}
