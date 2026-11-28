import type { Metadata } from "next";
import { liveStore, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { storeTheme } from "@/themes/store/registry";

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { config } = await liveStore((await params).host);
  return storeMetadata(config, { title: ar.storefront.wishlist.title, path: "/wishlist", noindex: true });
}

/** «المفضلة»: the products the visitor saved on this device (no account needed), drawn by the theme. */
export default async function WishlistPage({ params }: Props) {
  const { config } = await liveStore((await params).host);
  const { Wishlist } = storeTheme(config.theme_key).pages;
  return <Wishlist />;
}
