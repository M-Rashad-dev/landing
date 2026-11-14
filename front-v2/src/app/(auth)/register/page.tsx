import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/register-form";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.auth.registerTitle };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** `?store=` comes from the platform home page (the visitor typed the store name there). */
export default async function RegisterPage({ searchParams }: Props) {
  const store = (await searchParams).store;
  return <RegisterForm storeName={typeof store === "string" ? store.trim().slice(0, 100) : ""} />;
}
