import type { Metadata } from "next";
import { liveStore, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { storeTheme } from "@/themes/store/registry";

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { config } = await liveStore((await params).host);
  return storeMetadata(config, { title: ar.storefront.cartPage.title, path: "/cart", noindex: true });
}

export default async function CartPage({ params }: Props) {
  const { config } = await liveStore((await params).host);
  const { Cart } = storeTheme(config.theme_key).pages;
  return <Cart />;
}
