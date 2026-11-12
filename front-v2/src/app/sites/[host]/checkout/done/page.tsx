import type { Metadata } from "next";
import { liveStore, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { OrderDone } from "@/themes/asas/pages/info";

type Props = { params: Promise<{ host: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { config } = await liveStore((await params).host);
  return storeMetadata(config, { title: ar.storefront.done.title, path: "/checkout/done", noindex: true });
}

/** The thank-you page; the order number and total come in the link (display only). */
export default async function OrderDonePage({ params, searchParams }: Props) {
  await liveStore((await params).host);
  const search = await searchParams;
  const order = typeof search.order === "string" && /^\d{1,9}$/.test(search.order) ? Number(search.order) : null;
  const total = typeof search.total === "string" && /^\d{1,9}(\.\d{1,2})?$/.test(search.total) ? Number(search.total) : null;
  return <OrderDone orderNumber={order} total={total} />;
}
