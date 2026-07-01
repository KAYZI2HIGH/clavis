"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { makeId } from "@/lib/vault-utils";

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
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const [authedName, setAuthedName] = useState("");
  const [authedPhone, setAuthedPhone] = useState("");

  const signUp = useCallback(
    ({ name, phone }: { name: string; phone: string; pin: string }) => {
      setAuthedUserId(makeId("usr"));
      setAuthedName(name.trim());
      setAuthedPhone(phone.trim());
    },
    [],
  );

  const signIn = useCallback(({ phone, pin }: { phone: string; pin: string }) => {
    if (!phone.trim() || pin.length !== 4) return false;
    setAuthedUserId((prev) => prev ?? makeId("usr"));
    setAuthedName((prev) => prev || "Founder");
    setAuthedPhone(phone.trim());
    return true;
  }, []);

  const signOut = useCallback(() => {
    setAuthedUserId(null);
    setAuthedName("");
    setAuthedPhone("");
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
