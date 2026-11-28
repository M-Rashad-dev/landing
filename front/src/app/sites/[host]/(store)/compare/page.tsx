import type { Metadata } from "next";
import { liveStore, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { storeTheme } from "@/themes/store/registry";

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { config } = await liveStore((await params).host);
  return storeMetadata(config, { title: ar.storefront.compare.title, path: "/compare", noindex: true });
}

/** «قارن»: the products the visitor picked (kept in their browser), drawn by the theme. */
export default async function ComparePage({ params }: Props) {
  const { config } = await liveStore((await params).host);
  const { Compare } = storeTheme(config.theme_key).pages;
  return <Compare />;
}
