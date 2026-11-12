import type { Metadata } from "next";
import { liveStore, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { TrackView } from "@/themes/asas/pages/track";

type Props = { params: Promise<{ host: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { config } = await liveStore((await params).host);
  return storeMetadata(config, { title: ar.storefront.track.title, path: "/track", noindex: true });
}

export default async function TrackPage({ params, searchParams }: Props) {
  await liveStore((await params).host);
  const order = (await searchParams).order;
  return <TrackView initialNumber={typeof order === "string" && /^\d{1,9}$/.test(order) ? order : ""} />;
}
