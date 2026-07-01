"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function HashJoinRedirect() {
  const router = useRouter();

  useEffect(() => {
    const redirect = () => {
      const m = window.location.hash.match(/join=([A-Z0-9]+)/i);
      if (m) {
        router.replace(`/join-vault?token=${m[1]}`);
      }
    };
    redirect();
    window.addEventListener("hashchange", redirect);
    return () => window.removeEventListener("hashchange", redirect);
  }, [router]);

  return null;
}
