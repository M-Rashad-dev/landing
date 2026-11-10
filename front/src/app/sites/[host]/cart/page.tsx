import type { Metadata } from "next";
import { loadStore, storeMetadata } from "@/lib/public/store-route";
import { siteMessages } from "@/messages/site";
import { LOOKS } from "@/themes/shared/sections/looks";
import { storePaths } from "@/themes/shared/store/links";
import { CartView } from "@/themes/store/cart-view";
import { storeLook } from "@/themes/store/look";
import { StoreFrame, storeContext } from "@/themes/store/store-frame";
import { SuspendedStore } from "../suspended";

/** ISR like the landing pages: cached per host/path, refreshed by tag on edit (or after 60 s). */
export const revalidate = 60;

export function generateStaticParams(): Array<Record<string, string>> {
  return [];
}

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await loadStore((await params).host, storePaths.cart);
  if (!store.config) return { title: { absolute: "—" } };
  return storeMetadata(store.config, { title: siteMessages.store.cart, path: storePaths.cart, noindex: true });
}

/** The visitor's cart (kept in the browser), priced live by the server. */
export default async function StoreCartPage({ params }: Props) {
  const store = await loadStore((await params).host, storePaths.cart);
  if (!store.config) return <SuspendedStore />;
  const { config, host } = store;
  const look = storeLook(config.theme_key);

  return (
    <StoreFrame config={config} ctx={storeContext(config, host)}>
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <h1 className="t-heading mb-6 text-2xl font-extrabold md:text-3xl">{siteMessages.store.cart}</h1>
        <CartView surface={look.surface} button={LOOKS[look.block].button} muted={look.muted} />
      </div>
    </StoreFrame>
  );
}
