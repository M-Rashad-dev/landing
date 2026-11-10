import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ar } from "@/messages/ar";
import { ThemeEditor } from "./theme-editor";

export const metadata: Metadata = { title: ar.admin.nav.themes };

export default async function AdminThemePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[a-z0-9_-]{1,40}$/.test(key)) notFound();

  return <ThemeEditor themeKey={key} />;
}
