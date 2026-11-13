import type { Metadata } from "next";
import { landingMetadata, loadLandingPage } from "@/lib/public/landing";
import { StorePaused } from "@/themes/asas/pages/info";
import { LandingDone } from "@/themes/bidaya/live";

type Props = { params: Promise<{ host: string; slug: string }>; searchParams: Promise<{ order?: string }> };

const slugOf = (raw: string) => decodeURIComponent(raw).toLowerCase();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host, slug } = await params;
  const site = await loadLandingPage(host, slugOf(slug));
  if (site.suspended) return { title: { absolute: "" }, robots: { index: false, follow: false } };
  return landingMetadata(site.page, `/${site.page.page.slug}/done`);
}

/** «طلبك وصل» after an order from a landing page (never indexed). */
export default async function LandingDonePage({ params, searchParams }: Props) {
  const { host, slug } = await params;
  const site = await loadLandingPage(host, slugOf(slug));
  if (site.suspended) return <StorePaused />;
  const order = Number((await searchParams).order);
  return <LandingDone payload={site.page} orderNumber={Number.isInteger(order) && order > 0 ? order : null} />;
}
