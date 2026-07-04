"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, type SignInSchema } from "@/lib/schemas";
import { Field } from "@/components/shared/field";
import { InputStyles } from "@/components/shared/input-styles";
import { PinInput } from "@/components/shared/pin-input";
import { Loader2 } from "lucide-react";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const authError = searchParams.get("error");

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SignInSchema>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      pin: "",
    },
  });

  const onSubmit = async (data: SignInSchema) => {
    const callbackUrl = token ? `/join-vault?token=${token}` : "/home";
    const result = await signIn("credentials", {
      email: data.email.trim(),
      pin: data.pin,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setError("root", { message: "Incorrect email or PIN" });
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

      <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-5">
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
          <p className="engraved mb-3 text-center">PIN</p>
          <Controller
            name="pin"
            control={control}
            render={({ field }) => (
              <PinInput
                value={field.value}
                onChange={field.onChange}
                autoFocus
              />
            )}
          />
          {errors.pin && (
            <p className="text-xs text-crimson text-center mt-1">{errors.pin.message}</p>
          )}
        </div>
        {(errors.root?.message || authError) && (
          <p className="text-sm text-crimson text-center">Incorrect email or PIN</p>
        )}

        <button
          type="submit"
          className="btn-mech btn-mech-primary w-full mt-10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Sign in"
          )}
        </button>
      </form>
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
