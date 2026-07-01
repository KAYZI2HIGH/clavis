"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useVaultContext } from "./vault-provider";

type AuthContextValue = {
  authedUserId: string | null;
  signIn: (input: { phone: string; pin: string }) => boolean;
  signUp: (input: { name: string; phone: string; pin: string }) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const { setActor, updateMemberName } = useVaultContext();

  const signUp = useCallback(
    ({ name }: { name: string; phone: string; pin: string }) => {
      const firstId = "mr";
      updateMemberName(firstId, name);
      setActor(firstId);
      setAuthedUserId(firstId);
    },
    [setActor, updateMemberName],
  );

  const signIn = useCallback(
    ({ phone, pin }: { phone: string; pin: string }) => {
      if (!phone.trim() || pin.length !== 4) return false;
      setAuthedUserId("mr");
      setActor("mr");
      return true;
    },
    [setActor],
  );

  const signOut = useCallback(() => {
    setAuthedUserId(null);
  }, []);

  const value = useMemo(
    () => ({ authedUserId, signIn, signUp, signOut }),
    [authedUserId, signIn, signUp, signOut],
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
