import { ChevronDown, MessageCircle, Search } from "lucide-react";
import type { ReactNode } from "react";
import { serverEnv } from "@/lib/env";
import { applyPageDesign } from "@/lib/identity/page-design";
import { whatsappHref } from "@/lib/links";
import type { StoreConfig, StoreMenuLink } from "@/lib/public/store";
import { TrackingScripts } from "@/lib/tracking/tracking-scripts";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";
import { ContactList, SocialLinks } from "@/themes/shared/components/contact-list";
import { MobileMenu } from "@/themes/shared/components/mobile-menu";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import { SafeLink } from "@/themes/shared/components/safe-link";
import { SiteEnhancer } from "@/themes/shared/components/site-enhancer";
import { IdentityFonts } from "@/themes/shared/identity-fonts";
import { IdentityStyle } from "@/themes/shared/identity-style";
import { PlatformBadge } from "@/themes/shared/platform-badge";
import { storePaths } from "@/themes/shared/store/links";
import type { PageContext, PublicIdentity } from "@/themes/types";
import { CartButton } from "./cart-button";
import { storeLook } from "./look";

const t = siteMessages.store;

/** The PageContext store pages and home sections render with (no landing product). */
export function storeContext(config: StoreConfig & { identity: PublicIdentity }, host: string): PageContext {
  return {
    host,
    isPreview: false,
    identity: applyPageDesign(config.identity, config.home.content.design),
    product: null,
    offers: [],
    page: { id: config.home.id ?? 0, slug: "", title: config.seo.title },
    media: config.home.media ?? {},
    shipping: config.shipping,
    store: { categories: config.categories, products: config.home.data.products ?? {} },
  };
}

/** Header links: the merchant's menu, or the top categories when there is none. */
function headerLinks(config: StoreConfig): StoreMenuLink[] {
  if (config.menus.header.length > 0) return config.menus.header;
  const tops = config.categories.filter((c) => c.parent_id === null).slice(0, 6);
  return [
    { label: t.allProducts, href: storePaths.products, children: [] },
    ...tops.map((c) => ({
      label: c.name,
      href: storePaths.category(c.slug),
      children: config.categories.filter((s) => s.parent_id === c.id).slice(0, 10).map((s) => ({ label: s.name, href: storePaths.category(s.slug) })),
    })),
  ];
}

function footerLinks(config: StoreConfig): StoreMenuLink[] {
  if (config.menus.footer.length > 0) return config.menus.footer;
  return config.pages.map((p) => ({ label: p.title, href: storePaths.page(p.slug), children: [] }));
}

/**
 * Store layout around every store page: identity look, announcement, header (logo, menu,
 * search, cart), footer, WhatsApp button, pixels. One markup for every store theme; the theme
 * picks the classes (themes/store/look.ts).
 */
export function StoreFrame({ config, ctx, children, searchQuery }: { config: StoreConfig; ctx: PageContext; children: ReactNode; searchQuery?: string }) {
  const look = storeLook(config.theme_key);
  const identity = ctx.identity;
  const links = headerLinks(config);
  const footer = footerLinks(config);
  const whatsapp = config.settings.show_whatsapp ? whatsappHref(identity.contact.whatsapp) : null;

  const brand = (
    <a href={storePaths.home} className="flex min-w-0 items-center gap-2" aria-label={identity.brand_name || t.home}>
      {identity.logo ? (
        <ResponsiveImage image={identity.logo} sizes="160px" priority className="h-9 w-auto max-w-40 object-contain md:h-11" alt={identity.brand_name} />
      ) : (
        <span className="t-heading truncate text-lg font-extrabold md:text-xl">{identity.brand_name}</span>
      )}
    </a>
  );

  const search = (
    <form action={storePaths.products} method="get" role="search" className="relative w-full">
      <Search className="t-muted pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2" aria-hidden />
      <input type="search" name="q" defaultValue={searchQuery} maxLength={60} placeholder={t.searchPlaceholder} aria-label={t.search} className={look.search} />
    </form>
  );

  return (
    <>
      <IdentityFonts heading={identity.font_heading} body={identity.font_body} />
      <IdentityStyle identity={identity} themeKey={config.theme_key} className="t-site flex min-h-dvh flex-col">
        {config.settings.announcement ? <p className={look.announcement}>{config.settings.announcement}</p> : null}
        <header className={look.header}>
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:h-20">
            <MobileMenu className="md:hidden" buttonClassName={look.iconButton} panelClassName={cn(look.dropdown, "flex flex-col gap-1")}>
              <div className="p-2 md:hidden">{search}</div>
              {links.map((link) => (
                <div key={`${link.href}-${link.label}`} className="flex flex-col">
                  <SafeLink href={link.href} className={look.navLink}>
                    {link.label}
                  </SafeLink>
                  {link.children.map((child) => (
                    <SafeLink key={`${child.href}-${child.label}`} href={child.href} className={cn(look.navLink, "ps-6 font-normal")}>
                      {child.label}
                    </SafeLink>
                  ))}
                </div>
              ))}
            </MobileMenu>
            {brand}
            <nav aria-label={t.menu} className="hidden flex-1 items-center justify-center gap-1 md:flex">
              {links.map((link) =>
                link.children.length > 0 ? (
                  <div key={`${link.href}-${link.label}`} className="group relative">
                    <SafeLink href={link.href} className={cn(look.navLink, "inline-flex items-center gap-1")}>
                      {link.label}
                      <ChevronDown className="size-3.5" aria-hidden />
                    </SafeLink>
                    <div className={cn(look.dropdown, "invisible absolute start-0 top-full z-50 flex min-w-48 flex-col opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100")}>
                      {link.children.map((child) => (
                        <SafeLink key={`${child.href}-${child.label}`} href={child.href} className={look.navLink}>
                          {child.label}
                        </SafeLink>
                      ))}
                    </div>
                  </div>
                ) : (
                  <SafeLink key={`${link.href}-${link.label}`} href={link.href} className={look.navLink}>
                    {link.label}
                  </SafeLink>
                ),
              )}
            </nav>
            <div className="ms-auto flex items-center gap-1 md:ms-0">
              <div className="hidden w-56 lg:block">{search}</div>
              <a href={storePaths.products} className={cn(look.iconButton, "lg:hidden")} aria-label={t.search}>
                <Search className="size-5" aria-hidden />
              </a>
              <CartButton className={look.iconButton} badgeClassName={look.badge} />
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className={look.footer}>
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
            <div className="flex flex-col gap-3">
              {brand}
              {identity.seo_description ? <p className={cn(look.muted, "text-sm leading-relaxed")}>{identity.seo_description}</p> : null}
              <SocialLinks ctx={ctx} linkClassName={look.iconButton} />
            </div>
            {footer.length > 0 ? (
              <nav aria-label={t.pages} className="flex flex-col gap-2">
                <p className="t-heading font-bold">{t.pages}</p>
                {footer.map((link) => (
                  <SafeLink key={`${link.href}-${link.label}`} href={link.href} className={cn(look.muted, "text-sm hover:underline")}>
                    {link.label}
                  </SafeLink>
                ))}
                <a href="/track" className={cn(look.muted, "text-sm hover:underline")}>
                  {siteMessages.track.link}
                </a>
              </nav>
            ) : (
              <nav aria-label={t.pages} className="flex flex-col gap-2">
                <a href="/track" className={cn(look.muted, "text-sm hover:underline")}>
                  {siteMessages.track.link}
                </a>
              </nav>
            )}
            <div className="flex flex-col gap-2">
              <p className="t-heading font-bold">{siteMessages.contactUs}</p>
              <ContactList ctx={ctx} itemClassName={look.muted} />
            </div>
          </div>
          <p className={cn(look.muted, "pb-6 text-center text-xs")}>
            © {new Date().getFullYear()} {identity.brand_name}
          </p>
          {config.branding ? <PlatformBadge platformDomain={serverEnv().platformDomain} /> : null}
        </footer>

        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={siteMessages.whatsapp} className="fixed bottom-5 end-5 z-40 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105">
            <MessageCircle className="size-7" aria-hidden />
          </a>
        ) : null}
        <SiteEnhancer />
      </IdentityStyle>
      <TrackingScripts tracking={config.tracking} product={null} />
    </>
  );
}
