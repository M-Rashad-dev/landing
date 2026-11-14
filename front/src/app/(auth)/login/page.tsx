import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.auth.loginTitle };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
