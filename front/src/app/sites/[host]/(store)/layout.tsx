import type { Metadata, Viewport } from "next";
import { loadStore, storeMetadata } from "@/lib/public/store";
import { serverEnv } from "@/lib/env";
import { StoreNotReady, StorePaused } from "@/themes/store/asas/pages/info";
import { StoreShell } from "@/themes/store/shell";

type Props = { children: React.ReactNode; params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await loadStore((await params).host);
  if (store.suspended) return { title: { absolute: "" }, robots: { index: false, follow: false } };
  return storeMetadata(store.config, { path: "/" });
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const store = await loadStore((await params).host);
  return { themeColor: store.suspended ? "#ffffff" : store.config.design.settings.colors.background };
}

/** Every page of a store: its theme frame (header, footer, cart), or the paused page. */
export default async function StoreLayout({ children, params }: Props) {
  const store = await loadStore((await params).host);
  if (store.suspended && store.notReady) {
    const env = serverEnv();
    return <StoreNotReady dashboardUrl={`${env.publicScheme}://${env.appHost}${env.publicPort ? `:${env.publicPort}` : ""}/dashboard`} />;
  }
  if (store.suspended) return <StorePaused />;
  return <StoreShell config={store.config}>{children}</StoreShell>;
}
