import type { Metadata } from "next";
import { ThemeDetail } from "@/features/landings/theme-detail";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.landings.gallery.title };

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <ThemeDetail themeKey={decodeURIComponent(key)} />;
}
