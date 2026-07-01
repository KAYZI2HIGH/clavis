import { Suspense } from "react";
import { AuthShell } from "@/components/layouts/auth-shell";
import { SignUpForm } from "./_components/sign-up-form";

export default function SignUpPage() {
  return (
    <AuthShell>
      <Suspense>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  );
}
