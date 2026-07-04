"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpSchema } from "@/lib/schemas";
import { Field } from "@/components/shared/field";
import { InputStyles } from "@/components/shared/input-styles";
import { PinInput } from "@/components/shared/pin-input";
import { Loader2 } from "lucide-react";

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SignUpSchema>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      pin: "",
    },
  });

  const onSubmit = async (data: SignUpSchema) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: data.full_name.trim(),
          email: data.email.trim(),
          phone: data.phone.trim(),
          pin: data.pin,
        }),
      });

      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        const message = payload.error ?? "Failed to create account";
        setError("root", { message });
        toast.error(message);
        return;
      }

      const callbackUrl = token ? `/join-vault?token=${token}` : "/home";
      const result = await signIn("credentials", {
        email: data.email.trim(),
        pin: data.pin,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("root", { message: "Account created, but automatic sign-in failed" });
        toast.error("Account created, but sign-in failed");
        return;
      }

      toast.success("Account created");
      router.push(result?.url ?? callbackUrl);
    } catch {
      setError("root", { message: "Failed to create account" });
      toast.error("Failed to create account");
    }
  };

  const signInHref = token ? `/sign-in?token=${token}` : "/sign-in";

  return (
    <div className="max-w-sm w-full">
      <h1 className="serif text-2xl text-ink">Create your account</h1>
      <p className="text-sm text-ink-muted mt-2">
        A short identity for your seat at the vault.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-5">
        <Field label="Full name">
          <input
            className="input-mech"
            placeholder="Mira Reeve"
            disabled={isSubmitting}
            {...register("full_name")}
          />
          {errors.full_name && (
            <p className="text-xs text-crimson mt-1">{errors.full_name.message}</p>
          )}
        </Field>
        <Field label="Phone number">
          <input
            className="input-mech mono"
            placeholder="+1 555 0140"
            disabled={isSubmitting}
            {...register("phone")}
          />
          {errors.phone && (
            <p className="text-xs text-crimson mt-1">{errors.phone.message}</p>
          )}
        </Field>
        <Field label="Email address">
          <input
            className="input-mech"
            type="email"
            placeholder="you@example.com"
            disabled={isSubmitting}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-crimson mt-1">{errors.email.message}</p>
          )}
        </Field>
        <div>
          <p className="engraved mb-3 text-center">Set a 4-digit PIN</p>
          <Controller
            name="pin"
            control={control}
            render={({ field }) => (
              <PinInput
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {errors.pin && (
            <p className="text-xs text-crimson text-center mt-1">{errors.pin.message}</p>
          )}
        </div>
        {errors.root?.message && (
          <p className="text-sm text-crimson text-center">{errors.root.message}</p>
        )}

        <button
          type="submit"
          className="btn-mech btn-mech-primary w-full mt-10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Continue"
          )}
        </button>
      </form>
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
