import type { Metadata } from "next";
import { ThemeEditorPage } from "@/features/admin/theme-editor";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.themes.title };

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <ThemeEditorPage themeKey={decodeURIComponent(key)} />;
}
