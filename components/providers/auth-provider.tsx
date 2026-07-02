"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { signOut as nextAuthSignOut, useSession } from "next-auth/react";

type AuthContextValue = {
  authedUserId: string | null;
  authedName: string;
  authedPhone: string;
  signIn: (input: { phone: string; pin: string }) => boolean;
  signUp: (input: { name: string; phone: string; pin: string }) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const authedUserId = session?.user?.id ?? null;
  const authedName = session?.user?.name ?? "";
  const authedPhone = session?.user?.phone ?? "";

  const signUp = useCallback(
    (_input: { name: string; phone: string; pin: string }) => {},
    [],
  );

  const signIn = useCallback(
    (_input: { phone: string; pin: string }) => false,
    [],
  );

  const signOut = useCallback(() => {
    void nextAuthSignOut({ redirectTo: "/sign-in" });
  }, []);

  const value = useMemo(
    () => ({
      authedUserId,
      authedName,
      authedPhone,
      signIn,
      signUp,
      signOut,
    }),
    [authedUserId, authedName, authedPhone, signIn, signUp, signOut],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
