import type { Metadata } from "next";
import { Suspense } from "react";
import { ar } from "@/messages/ar";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: ar.auth.loginTitle };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
