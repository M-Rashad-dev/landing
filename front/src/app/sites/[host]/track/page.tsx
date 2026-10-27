import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import { getStoreBrand, resolveHost } from "@/lib/public/api";
import { parseSiteHost, primaryRedirectUrl } from "@/lib/public/host";
import { siteMessages } from "@/messages/site";
import { IdentityFonts } from "@/themes/shared/identity-fonts";
import { IdentityStyle } from "@/themes/shared/identity-style";
import { SuspendedStore } from "../suspended";
import { TrackForm } from "./track-form";

export const revalidate = 60;

export function generateStaticParams(): Array<{ host: string }> {
  return [];
}

export const metadata: Metadata = { title: siteMessages.track.title, robots: { index: false, follow: false } };

type Params = Promise<{ host: string }>;

/** /track on a store's site: the customer checks an order with its number + phone. */
export default async function TrackPage({ params }: { params: Params }) {
  const host = parseSiteHost((await params).host);
  if (!host) notFound();
  const site = await resolveHost(host);
  if (!site) notFound();
  if (site.status === "suspended") return <SuspendedStore />;
  if (!site.is_primary) {
    const env = serverEnv();
    permanentRedirect(primaryRedirectUrl(site.primary_host, "/track", { scheme: env.publicScheme, port: env.publicPort }));
  }

  const brand = await getStoreBrand(host);
  if (!brand?.identity) notFound();
  const identity = brand.identity;

  return (
    <>
      <IdentityFonts heading={identity.font_heading} body={identity.font_body} />
      <IdentityStyle identity={identity} className="t-site flex min-h-dvh flex-col">
        <header className="t-border border-b px-4 py-4">
          <Link href="/" className="mx-auto flex max-w-xl items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- store logo from the media volume */}
            {identity.logo ? <img src={identity.logo.urls.thumb} alt={identity.brand_name} className="h-9 w-auto max-w-32 object-contain" /> : null}
            <span className="t-heading text-lg font-bold">{identity.brand_name}</span>
          </Link>
        </header>
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
          <TrackForm />
        </main>
      </IdentityStyle>
    </>
  );
}
