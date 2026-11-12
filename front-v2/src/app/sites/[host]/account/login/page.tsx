import type { Metadata } from "next";
import { liveStore, storeMetadata } from "@/lib/public/store";
import { ar } from "@/messages/ar";
import { SignInView } from "@/themes/asas/pages/account";

type Props = { params: Promise<{ host: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { config } = await liveStore((await params).host);
  return storeMetadata(config, { title: ar.storefront.account.signIn, path: "/account/login", noindex: true });
}

/** Sign in with the phone and a one-time code. */
export default async function SignInPage({ params, searchParams }: Props) {
  await liveStore((await params).host);
  const next = (await searchParams).next;
  return <SignInView next={typeof next === "string" ? next : null} />;
}
