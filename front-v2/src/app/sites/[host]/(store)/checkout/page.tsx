import type { Metadata } from "next";
import { liveStore, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { CheckoutView } from "@/themes/asas/pages/checkout";

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { config } = await liveStore((await params).host);
  return storeMetadata(config, { title: ar.storefront.checkout.title, path: "/checkout", noindex: true });
}

export default async function CheckoutPage({ params }: Props) {
  const { config } = await liveStore((await params).host);
  return <CheckoutView config={config} />;
}
