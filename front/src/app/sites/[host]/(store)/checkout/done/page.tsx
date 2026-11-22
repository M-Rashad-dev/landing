import type { Metadata } from "next";
import { liveStore, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { storeTheme } from "@/themes/store/registry";

type Props = { params: Promise<{ host: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { config } = await liveStore((await params).host);
  return storeMetadata(config, { title: ar.storefront.done.title, path: "/checkout/done", noindex: true });
}

/** The thank-you page; the order number and total come in the link (display only). */
export default async function OrderDonePage({ params, searchParams }: Props) {
  const { config } = await liveStore((await params).host);
  const { OrderDone } = storeTheme(config.theme_key).pages;
  const search = await searchParams;
  const order = typeof search.order === "string" && /^\d{1,9}$/.test(search.order) ? Number(search.order) : null;
  const total = typeof search.total === "string" && /^\d{1,9}(\.\d{1,2})?$/.test(search.total) ? Number(search.total) : null;
  // A prepaid order: its private token, for «ادفع وارفع الإيصال».
  const pay = typeof search.pay === "string" && /^[a-z0-9]{12}$/.test(search.pay) ? search.pay : null;
  return <OrderDone orderNumber={order} total={total} pay={pay} />;
}
