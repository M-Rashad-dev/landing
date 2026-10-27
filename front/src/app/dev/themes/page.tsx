import "@/components/shared/dashboard-fonts";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/700.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemesReview } from "./themes-review";

export const metadata: Metadata = { title: "Themes review", robots: { index: false, follow: false } };

/** Visual review of every component × variant with demo data. Development only. */
export default async function DevThemesPage({ searchParams }: { searchParams: Promise<{ theme?: string; identity?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { theme, identity } = await searchParams;
  return <ThemesReview initialTheme={theme ?? "malak"} initialIdentity={identity ?? "violet"} />;
}
