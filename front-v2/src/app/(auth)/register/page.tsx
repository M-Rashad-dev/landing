import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/register-form";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.auth.registerTitle };

export default function RegisterPage() {
  return <RegisterForm />;
}
