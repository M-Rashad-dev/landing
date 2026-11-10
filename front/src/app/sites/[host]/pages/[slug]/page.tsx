import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/shared/markdown";
import { getStorePage } from "@/lib/public/store";
import { loadStore, storeMetadata } from "@/lib/public/store-route";
import { siteMessages } from "@/messages/site";
import { storePaths } from "@/themes/shared/store/links";
import { storeLook } from "@/themes/store/look";
import { Breadcrumb } from "@/themes/store/product-listing";
import { StoreFrame, storeContext } from "@/themes/store/store-frame";
import { SuspendedStore } from "../../suspended";

/** ISR like the landing pages: cached per host/path, refreshed by tag on edit (or after 60 s). */
export const revalidate = 60;

export function generateStaticParams(): Array<Record<string, string>> {
  return [];
}

type Props = { params: Promise<{ host: string; slug: string }> };

async function load(params: Props["params"]) {
  const { host, slug } = await params;
  const store = await loadStore(host, storePaths.page(slug));
  if (!store.config) return { store, page: null };
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug).toLowerCase().slice(0, 120);
  } catch {
    notFound();
  }
  const page = await getStorePage(store.host, decoded);
  if (!page) notFound();
  return { store, page };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store, page } = await load(params);
  if (!store.config || !page) return { title: { absolute: "—" } };
  return storeMetadata(store.config, { title: page.seo?.title || page.title, description: page.seo?.description || page.body, path: storePaths.page(page.slug) });
}

/** A static store page (about, returns, shipping, privacy...) written in Markdown. */
export default async function StoreStaticPage({ params }: Props) {
  const { store, page } = await load(params);
  if (!store.config || !page) return <SuspendedStore />;
  const look = storeLook(store.config.theme_key);

  return (
    <StoreFrame config={store.config} ctx={storeContext(store.config, store.host)}>
      <article className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <Breadcrumb items={[{ label: siteMessages.store.home, href: storePaths.home }, { label: page.title }]} look={look} />
        <h1 className="t-heading mb-6 text-2xl font-extrabold md:text-3xl">{page.title}</h1>
        <div className={look.surface}>
          <Markdown className="leading-relaxed [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-bold [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:ps-5">{page.body ?? ""}</Markdown>
        </div>
      </article>
    </StoreFrame>
  );
}
