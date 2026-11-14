import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND } from "@/config/brand";
import { MarketingHeader } from "@/features/marketing/header";
import "@/features/marketing/marketing.css";
import { MotionRoot } from "@/features/marketing/motion";
import { pageHeadings, platformPage, platformPageLinks } from "@/features/marketing/pages";
import { appUrl, pricingData, whatsappUrl } from "@/features/marketing/plans";
import { Prose } from "@/features/marketing/prose";
import { MarketingFooter } from "@/features/marketing/sections-bottom";
import { PLATFORM_PAGE_SLUGS } from "@/lib/host/platform-pages";
import { ar } from "@/messages/ar";

const t = ar.marketing.page;
type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return PLATFORM_PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await platformPage((await params).slug);
  if (!page) return { title: BRAND.name };
  return {
    title: { absolute: `${page.title} | ${BRAND.name}` },
    description: page.summary ?? undefined,
    robots: { index: true, follow: true },
    openGraph: { title: `${page.title} | ${BRAND.name}`, description: page.summary ?? undefined, type: "article", locale: "ar_EG" },
  };
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" }).format(date);
}

/** A platform page (about, terms, privacy…) at /{slug} on the platform domain; the super admin writes it. */
export default async function PlatformPageView({ params }: Props) {
  const { slug } = await params;
  const [page, links, pricing] = await Promise.all([platformPage(slug), platformPageLinks(), pricingData()]);
  if (!page) notFound();

  const headings = pageHeadings(page.body);
  const updated = formatDate(page.updated_at);
  const whatsapp = whatsappUrl(pricing?.support.whatsapp ?? null);
  const others = links.filter((l) => l.slug !== page.slug);

  return (
    <div className="mk">
      <script dangerouslySetInnerHTML={{ __html: "if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('mk-js')" }} />
      <MotionRoot />
      <MarketingHeader loginUrl={appUrl("/login")} registerUrl={appUrl("/register")} home="/" />
      <main id="main" className="pb-24 pt-10 md:pb-32 md:pt-16">
        <div className="mk-wrap">
          <nav aria-label={t.home} className="mb-8 text-sm text-ink-3" data-reveal="fade">
            <Link href="/" className="mk-link hover:text-ink">
              {t.home}
            </Link>
            <span className="mx-2" aria-hidden>
              /
            </span>
            <span className="text-ink-2">{page.title}</span>
          </nav>
          <header className="max-w-3xl border-b border-border pb-10">
            <h1 className="mk-display text-[clamp(36px,6vw,64px)] font-semibold leading-[1.15]" data-reveal>
              {page.title}
            </h1>
            {page.summary ? (
              <p className="mk-sub mt-5" data-reveal style={{ "--d": "100ms" } as React.CSSProperties}>
                {page.summary}
              </p>
            ) : null}
            {updated ? (
              <p className="mt-5 text-sm text-ink-3" data-reveal style={{ "--d": "180ms" } as React.CSSProperties}>
                {t.updated(updated)}
              </p>
            ) : null}
          </header>

          <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-20">
            <aside className="hidden lg:block">
              <div className="sticky top-28 flex flex-col gap-8">
                {headings.length > 1 ? (
                  <nav aria-label={t.toc}>
                    <p className="mb-3 text-sm font-semibold">{t.toc}</p>
                    <ol className="flex flex-col gap-2 border-s border-border ps-4 text-sm text-ink-2">
                      {headings.map((h) => (
                        <li key={h.id}>
                          <a href={`#${h.id}`} className="hover:text-ink">
                            {h.text}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                ) : null}
                {others.length > 0 ? (
                  <nav aria-label={t.more}>
                    <p className="mb-3 text-sm font-semibold">{t.more}</p>
                    <ul className="flex flex-col gap-2 text-sm text-ink-2">
                      {others.map((o) => (
                        <li key={o.slug}>
                          <a href={`/${o.slug}`} className="hover:text-ink">
                            {o.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                ) : null}
              </div>
            </aside>
            <article className="max-w-3xl" data-reveal="fade">
              <Prose body={page.body} />
              {whatsapp ? (
                <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--mk-paper-2)] p-6">
                  <div>
                    <p className="font-semibold">{t.contact}</p>
                    <p className="text-sm text-ink-2">{t.contactText}</p>
                  </div>
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mk-btn mk-btn-ink h-11 px-5 text-sm">
                    {ar.marketing.faq.whatsapp}
                  </a>
                </div>
              ) : null}
            </article>
          </div>
        </div>
      </main>
      <MarketingFooter loginUrl={appUrl("/login")} registerUrl={appUrl("/register")} support={pricing?.support ?? null} pages={links} home="/" />
    </div>
  );
}
