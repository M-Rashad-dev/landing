import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.auth.forgot.title };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
