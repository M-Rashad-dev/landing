import type { Metadata } from "next";
import { liveStore, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { AccountView } from "@/themes/asas/pages/account";

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { config } = await liveStore((await params).host);
  return storeMetadata(config, { title: ar.storefront.account.title, path: "/account", noindex: true });
}

/** «حسابي»: my orders, saved addresses, my details (signed-in customers only). */
export default async function AccountPage({ params }: Props) {
  await liveStore((await params).host);
  return <AccountView />;
}
