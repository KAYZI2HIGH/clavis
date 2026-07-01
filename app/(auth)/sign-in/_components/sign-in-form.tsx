"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Field } from "@/components/shared/field";
import { InputStyles } from "@/components/shared/input-styles";
import { PinInput } from "@/components/shared/pin-input";
import { useAuth } from "@/hooks/use-auth";

export function SignInForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = phone.trim() && pin.length === 4;

  const redirectAfterAuth = () => {
    if (token) {
      router.push(`/join-vault?token=${token}`);
    } else {
      router.push("/home");
    }
  };

  const submit = () => {
    if (!valid) return;
    setVerifying(true);
    setError(null);
    setTimeout(() => {
      const ok = signIn({ phone: phone.trim(), pin });
      if (!ok) {
        setVerifying(false);
        setError("Could not verify. Check the phone and PIN.");
      } else {
        redirectAfterAuth();
      }
    }, 1000);
  };

  const signUpHref = token ? `/sign-up?token=${token}` : "/sign-up";

  return (
    <div className="max-w-sm w-full">
      <h1 className="serif text-2xl text-ink">Sign in</h1>
      <p className="text-sm text-ink-muted mt-2">
        Enter your phone and PIN to return.
      </p>

      <div className="mt-10 space-y-5">
        <Field label="Phone number">
          <input
            className="input-mech mono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 0140"
            disabled={verifying}
          />
        </Field>
        <div>
          <p className="engraved mb-3 text-center">PIN</p>
          <PinInput value={pin} onChange={setPin} autoFocus />
        </div>
        {error && <p className="text-sm text-crimson text-center">{error}</p>}
      </div>

      <button
        className="btn-mech btn-mech-primary w-full mt-10 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!valid || verifying}
        onClick={submit}
      >
        {verifying ? "Verifying…" : "Sign in"}
      </button>
      <p className="text-xs text-ink-faint text-center mt-4">
        New here?{" "}
        <Link
          href={signUpHref}
          className="text-ink underline underline-offset-2"
        >
          Create an account
        </Link>
      </p>
      <InputStyles />
    </div>
  );
}
