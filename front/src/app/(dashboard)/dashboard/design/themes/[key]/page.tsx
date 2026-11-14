import type { Metadata } from "next";
import { StoreThemeDetail } from "@/features/builder/theme-detail";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.design.page.title };

type Props = { params: Promise<{ key: string }> };

export default async function Page({ params }: Props) {
  const { key } = await params;
  return <StoreThemeDetail themeKey={decodeURIComponent(key)} />;
}
