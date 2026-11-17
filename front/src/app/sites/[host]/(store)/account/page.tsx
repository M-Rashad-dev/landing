import type { Metadata } from "next";
import { liveStore, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { storeTheme } from "@/themes/store/registry";

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { config } = await liveStore((await params).host);
  return storeMetadata(config, { title: ar.storefront.account.title, path: "/account", noindex: true });
}

/** «حسابي»: my orders, saved addresses, my details (signed-in customers only). */
export default async function AccountPage({ params }: Props) {
  const { config } = await liveStore((await params).host);
  const { Account } = storeTheme(config.theme_key).pages;
  return <Account />;
}
