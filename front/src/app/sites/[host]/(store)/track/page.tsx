import type { Metadata } from "next";
import { liveStore, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { storeTheme } from "@/themes/store/registry";

type Props = { params: Promise<{ host: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { config } = await liveStore((await params).host);
  return storeMetadata(config, { title: ar.storefront.track.title, path: "/track", noindex: true });
}

export default async function TrackPage({ params, searchParams }: Props) {
  const { config } = await liveStore((await params).host);
  const { Track } = storeTheme(config.theme_key).pages;
  const query = await searchParams;
  const order = query.order;
  // ?t= comes from the link in the order messages: the order opens without typing anything.
  const token = typeof query.t === "string" && /^[a-z0-9]{12}$/.test(query.t) ? query.t : null;
  return <Track initialNumber={typeof order === "string" && /^\d{1,9}$/.test(order) ? order : ""} token={token} />;
}
