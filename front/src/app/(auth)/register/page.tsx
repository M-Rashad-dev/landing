import type { Metadata } from "next";
import { ar } from "@/messages/ar";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: ar.auth.registerTitle };

export default function RegisterPage() {
  return <RegisterForm />;
}
