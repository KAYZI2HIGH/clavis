import { Suspense } from "react";
import { AuthShell } from "@/components/layouts/auth-shell";
import { SignInForm } from "./_components/sign-in-form";

export default function SignInPage() {
  return (
    <AuthShell>
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
