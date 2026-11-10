import type { Metadata } from "next";
import { jsonLdString } from "@/lib/public/seo";
import { storeMetadata, type LiveStore } from "@/lib/public/store-route";
import { SiteRenderer } from "@/themes/site-renderer";
import { StoreBeacon } from "@/themes/store/store-beacon";
import { StoreFrame, storeContext } from "@/themes/store/store-frame";
import { SuspendedStore } from "./suspended";

export function storeHomeMetadata(store: LiveStore): Metadata {
  if (!store.config) return { title: { absolute: "—" }, robots: { index: false, follow: false } };
  return storeMetadata(store.config, { title: store.config.seo.title, description: store.config.seo.description, path: "/" });
}

/** "/" of a live store: the published store home (Builder sections) inside the store layout. */
export function StoreHome({ store }: { store: LiveStore }) {
  if (!store.config) return <SuspendedStore />;
  const { config, host } = store;
  const ctx = storeContext(config, host);
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: config.identity.brand_name,
    url: config.seo.canonical,
    logo: config.identity.logo?.urls.large,
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: config.identity.brand_name,
    url: config.seo.canonical,
    potentialAction: { "@type": "SearchAction", target: `${new URL("/products", config.seo.canonical).toString()}?q={search_term_string}`, "query-input": "required name=search_term_string" },
  };

  return (
    <StoreFrame config={config} ctx={ctx}>
      <SiteRenderer themeKey={config.theme_key} sections={config.home.content.sections} ctx={ctx} />
      <StoreBeacon type="view" onceKey="home" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString([organization, website]) }} />
    </StoreFrame>
  );
}
