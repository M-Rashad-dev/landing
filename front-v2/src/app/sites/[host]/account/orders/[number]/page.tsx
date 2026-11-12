import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { liveStore, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { MyOrderView } from "@/themes/asas/pages/account";

type Props = { params: Promise<{ host: string; number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host, number } = await params;
  const { config } = await liveStore(host);
  return storeMetadata(config, { title: ar.storefront.account.order(Number(number) || 0), path: "/account", noindex: true });
}

/** One of my orders: where it is, what is in it, and reviewing what arrived. */
export default async function MyOrderPage({ params }: Props) {
  const { host, number } = await params;
  await liveStore(host);
  if (!/^\d{1,9}$/.test(number)) notFound();
  return <MyOrderView number={Number(number)} />;
}
