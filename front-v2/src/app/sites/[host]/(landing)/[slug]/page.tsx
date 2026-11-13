import type { Metadata, Viewport } from "next";
import { landingMetadata, loadLandingPage } from "@/lib/public/landing";
import { StorePaused } from "@/themes/asas/pages/info";
import { LandingLive } from "@/themes/bidaya/live";

type Props = { params: Promise<{ host: string; slug: string }> };

const slugOf = (raw: string) => decodeURIComponent(raw).toLowerCase();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host, slug } = await params;
  const site = await loadLandingPage(host, slugOf(slug));
  if (site.suspended) return { title: { absolute: "" }, robots: { index: false, follow: false } };
  return landingMetadata(site.page);
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { host, slug } = await params;
  const site = await loadLandingPage(host, slugOf(slug));
  return { themeColor: site.suspended ? "#ffffff" : site.page.content.settings.colors.background };
}

/** A landing page on the store's domain (its own frame: no store header, footer or cart). */
export default async function LandingPage({ params }: Props) {
  const { host, slug } = await params;
  const site = await loadLandingPage(host, slugOf(slug));
  if (site.suspended) return <StorePaused />;
  return <LandingLive payload={site.page} />;
}
