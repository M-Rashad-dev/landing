import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorePage, liveStore, storeMetadata } from "@/lib/public/store";
import { StaticPageView } from "@/themes/asas/pages/info";

type Props = { params: Promise<{ host: string; slug: string }> };

function slugOf(raw: string): string | null {
  try {
    return decodeURIComponent(raw).toLowerCase();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host: rawHost, slug: rawSlug } = await params;
  const { host, config } = await liveStore(rawHost);
  const slug = slugOf(rawSlug);
  const page = slug ? await getStorePage(host, slug) : null;
  if (!page) return {};
  return storeMetadata(config, { title: page.seo?.title || page.title, description: page.seo?.description || page.body, path: `/pages/${encodeURIComponent(page.slug)}` });
}

/** A store page written by the merchant (policies, about, …). */
export default async function StaticPage({ params }: Props) {
  const { host: rawHost, slug: rawSlug } = await params;
  const { host } = await liveStore(rawHost);
  const slug = slugOf(rawSlug);
  const page = slug ? await getStorePage(host, slug) : null;
  if (!page) notFound();
  return <StaticPageView title={page.title} body={page.body} />;
}
