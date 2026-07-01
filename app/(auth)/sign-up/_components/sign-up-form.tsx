"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Field } from "@/components/shared/field";
import { InputStyles } from "@/components/shared/input-styles";
import { PinInput } from "@/components/shared/pin-input";
import { useAuth } from "@/hooks/use-auth";

export function SignUpForm() {
  const { signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);

  const valid = name.trim() && phone.trim() && pin.length === 4;

  const redirectAfterAuth = () => {
    if (token) {
      router.push(`/join-vault?token=${token}`);
    } else {
      router.push("/vault");
    }
  };

  const submit = () => {
    if (!valid) return;
    setVerifying(true);
    setTimeout(() => {
      signUp({ name: name.trim(), phone: phone.trim(), pin });
      redirectAfterAuth();
    }, 1200);
  };

  const signInHref = token ? `/sign-in?token=${token}` : "/sign-in";

  return (
    <div className="max-w-sm w-full">
      <h1 className="serif text-2xl text-ink">Create your account</h1>
      <p className="text-sm text-ink-muted mt-2">
        A short identity for your seat at the vault.
      </p>

      <div className="mt-10 space-y-5">
        <Field label="Full name">
          <input
            className="input-mech"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mira Reeve"
            disabled={verifying}
          />
        </Field>
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
          <p className="engraved mb-3 text-center">Set a 4-digit PIN</p>
          <PinInput value={pin} onChange={setPin} />
        </div>
      </div>

      <button
        className="btn-mech btn-mech-primary w-full mt-10 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!valid || verifying}
        onClick={submit}
      >
        {verifying ? "Verifying…" : "Continue"}
      </button>
      <p className="text-xs text-ink-faint text-center mt-4">
        Already have an account?{" "}
        <Link
          href={signInHref}
          className="text-ink underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
      <InputStyles />
    </div>
  );
}
