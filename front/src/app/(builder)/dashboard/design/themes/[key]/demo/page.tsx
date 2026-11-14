import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemeDemo } from "@/features/builder/theme-demo";
import { ar } from "@/messages/ar";
import { THEME_DEMOS } from "@/themes/registry";

export const metadata: Metadata = { title: ar.design.page.demo };

type Props = { params: Promise<{ key: string }> };

/** The showcase store of a theme that has one (others are previewed on the merchant's own store). */
export default async function Page({ params }: Props) {
  const key = decodeURIComponent((await params).key);
  if (!THEME_DEMOS.has(key)) notFound();
  return <ThemeDemo themeKey={key} />;
}
