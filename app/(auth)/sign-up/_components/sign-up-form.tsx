"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Field } from "@/components/shared/field";
import { InputStyles } from "@/components/shared/input-styles";
import { PinInput } from "@/components/shared/pin-input";

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim() && email.trim() && phone.trim() && pin.length === 4;

  const submit = async () => {
    if (!valid) return;
    setError(null);
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          pin,
        }),
      });

      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        const message = payload.error ?? "Failed to create account";
        setError(message);
        toast.error(message);
        setVerifying(false);
        return;
      }

      const callbackUrl = token ? `/join-vault?token=${token}` : "/home";
      const result = await signIn("credentials", {
        email: email.trim(),
        pin,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("Account created, but automatic sign-in failed");
        toast.error("Account created, but sign-in failed");
        setVerifying(false);
        return;
      }

      toast.success("Account created");
      router.push(result?.url ?? callbackUrl);
    } catch {
      setError("Failed to create account");
      toast.error("Failed to create account");
      setVerifying(false);
    }
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
          <p className="engraved mb-3 text-center">Set a 4-digit PIN</p>
          <PinInput value={pin} onChange={setPin} />
        </div>
        {error && <p className="text-sm text-crimson text-center">{error}</p>}
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
