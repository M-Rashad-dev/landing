import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingThemeDemo } from "@/features/landings/theme-demo";
import { ar } from "@/messages/ar";
import { hasLandingDemo } from "@/themes/landing/demos";

export const metadata: Metadata = { title: ar.landings.theme.demo };

type Props = { params: Promise<{ key: string }> };

/** A landing theme's showcase page, before buying it. */
export default async function Page({ params }: Props) {
  const key = decodeURIComponent((await params).key);
  if (!hasLandingDemo(key)) notFound();
  return <LandingThemeDemo themeKey={key} />;
}
