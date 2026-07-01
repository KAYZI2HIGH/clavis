"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActiveVault } from "@/hooks/use-vault";

export function RequireActiveVault({
  children,
}: {
  children: React.ReactNode;
}) {
  const vault = useActiveVault();
  const router = useRouter();

  useEffect(() => {
    if (!vault) {
      router.replace("/home");
    }
  }, [vault, router]);

  if (!vault) return null;
  return children;
}
