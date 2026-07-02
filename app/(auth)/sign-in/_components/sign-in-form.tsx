"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Field } from "@/components/shared/field";
import { InputStyles } from "@/components/shared/input-styles";
import { PinInput } from "@/components/shared/pin-input";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const authError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = email.trim() && pin.length === 4;

  const submit = async () => {
    if (!valid) return;
    setVerifying(true);
    setError(null);
    const callbackUrl = token ? `/join-vault?token=${token}` : "/home";
    const result = await signIn("credentials", {
      email: email.trim(),
      pin,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setVerifying(false);
      setError("Incorrect email or PIN");
      toast.error("Incorrect email or PIN");
      return;
    }

    toast.success("Welcome back");
    router.push(result?.url ?? callbackUrl);
  };

  const signUpHref = token ? `/sign-up?token=${token}` : "/sign-up";

  return (
    <div className="max-w-sm w-full">
      <h1 className="serif text-2xl text-ink">Sign in</h1>
      <p className="text-sm text-ink-muted mt-2">Enter your email and PIN to return.</p>

      <div className="mt-10 space-y-5">
        <Field label="Email address">
          <input
            className="input-mech"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={verifying}
          />
        </Field>
        <div>
          <p className="engraved mb-3 text-center">PIN</p>
          <PinInput value={pin} onChange={setPin} autoFocus />
        </div>
        {(error || authError) && (
          <p className="text-sm text-crimson text-center">Incorrect email or PIN</p>
        )}
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
