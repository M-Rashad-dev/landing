import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ar } from "@/messages/ar";
import { ThemeDetail } from "./theme-detail";

export const metadata: Metadata = { title: ar.themeStore.storeTitle };

export default async function ThemePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[a-z0-9_-]{1,40}$/.test(key)) notFound();

  return <ThemeDetail themeKey={key} />;
}
