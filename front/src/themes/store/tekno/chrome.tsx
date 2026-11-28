"use client";

import { ArrowLeftRight, ChevronDown, ChevronLeft, Heart, House, LayoutGrid, Mail, MapPin, Menu, Phone, Search, ShoppingCart, UserRound, X, Zap } from "lucide-react";
import * as React from "react";
import { useCompare } from "@/lib/store/compare";
import { cartCount, useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { pick, SOCIALS } from "@/themes/shared/design";
import { telLink, whatsappLink } from "@/themes/store/shared/contact";
import { StoreLink, useHydrated } from "@/themes/store/shared/context";
import { useShop } from "@/themes/store/shared/shop";
import type { DesignData } from "@/themes/store/shared/types";
import { SocialIcon, WhatsAppIcon } from "../asas/icons";
import { Photo, useImage } from "./parts";
import { useTekno } from "./root";

const t = ar.teknoStore;

type Category = DesignData["categories"][number];

const categoryHref = (c: { slug: string }) => `/categories/${encodeURIComponent(c.slug)}`;

/** The top categories, and the ones under a category. */
function useCategoryTree() {
  const { data } = useTekno();
  const top = data.categories.filter((c) => c.parent_id === null);
  return { top, children: (id: number) => data.categories.filter((c) => c.parent_id === id) };
}

/** Counts that live in the visitor's browser (cart, compare, wishlist): only in the live store, after hydration. */
function useLiveCount(count: number): number {
  const { mode } = useTekno();
  return useHydrated() && mode === "live" ? count : 0;
}

/** Escape closes. */
function useEscape(open: boolean, close: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);
}

function Logo({ small = false }: { small?: boolean }) {
  const { settings, data, media, storeName } = useTekno();
  const id = settings.logo_media_id;
  const logo = id ? pick(media[String(id)] ?? data.media[String(id)], "medium") : null;
  return (
    <StoreLink href="/" className="flex min-w-0 shrink-0 items-center">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- store logo from the media server
        <img src={logo} alt={storeName} className={cn("w-auto object-contain", small ? "h-8 max-w-[8.5rem]" : "h-11 max-w-[11rem]")} />
      ) : (
        <span className={cn("tk-logo truncate", small ? "text-[1.375rem]" : "text-[1.875rem]")}>
          {storeName}
          <b aria-hidden>.</b>
        </span>
      )}
    </StoreLink>
  );
}

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="tk-badge" aria-hidden>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** «ابحث باسم الجهاز…» with «كل الأقسام ▾»: a chosen category searches inside it (its page keeps the words). */
function SearchForm({ compact = false }: { compact?: boolean }) {
  const { settings, mode } = useTekno();
  const { top } = useCategoryTree();
  const [category, setCategory] = React.useState("");
  const withCategories = settings.header.search_categories && !compact && top.length > 0;
  const action = category ? `/categories/${encodeURIComponent(category)}` : "/products";
  return (
    <form role="search" action={action} className={cn("tk-search", compact ? "h-10" : "flex-1")} onSubmit={(e) => mode !== "live" && e.preventDefault()}>
      {withCategories ? (
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t.searchIn} className="as-sm">
          <option value="">{t.allCategories}</option>
          {top.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      ) : null}
      <input name="q" type="search" maxLength={60} placeholder={compact ? t.searchPlaceholderShort : t.searchPlaceholder} aria-label={t.searchLabel} className={compact ? "as-xs" : "as-sm"} />
      {compact ? (
        <button type="submit" className="!w-11 !bg-transparent text-slate-500" aria-label={t.search}>
          <Search className="mx-auto size-4" aria-hidden />
        </button>
      ) : (
        <button type="submit" className="as-sm">
          {t.search}
        </button>
      )}
    </form>
  );
}

/** «قارن», «المفضلة», «حسابي», «السلة» with their counts. */
function Tools() {
  const compare = useLiveCount(useCompare().count);
  const saved = useLiveCount(useWishlist().count);
  const cart = useLiveCount(cartCount(useCart()));
  const tools = [
    { href: "/compare", label: t.compare, icon: ArrowLeftRight, n: compare },
    { href: "/wishlist", label: t.wishlist, icon: Heart, n: saved },
    { href: "/account", label: t.account, icon: UserRound, n: 0 },
    { href: "/cart", label: t.cart, icon: ShoppingCart, n: cart },
  ];
  return (
    <nav className="flex shrink-0 items-center gap-[1.125rem]" aria-label={t.account}>
      {tools.map(({ href, label, icon: Icon, n }) => (
        <StoreLink key={href} href={href} className="tk-tool as-xs" aria-label={n > 0 ? t.count(label, n) : label}>
          <Badge n={n} />
          <Icon className="size-6" strokeWidth={1.8} aria-hidden />
          {label}
        </StoreLink>
      ))}
    </nav>
  );
}

/**
 * «قايمة الأقسام الكبيرة»: the side list of categories (the merchant's items, or the top categories), the active
 * one's link columns (or its sub-categories) and its promo card.
 */
function MegaMenu({ onClose }: { onClose: () => void }) {
  const { settings, data } = useTekno();
  const image = useImage();
  const { top, children } = useCategoryTree();
  const [active, setActive] = React.useState(0);
  const byId = new Map(data.categories.map((c) => [c.id, c]));
  const configured = settings.mega_menu.items.map((item, i) => ({ item, i, category: byId.get(item.category_id) })).filter((x): x is { item: (typeof x)["item"]; i: number; category: Category } => x.category !== undefined);
  const side = configured.length ? configured.map((x) => x.category) : top.slice(0, 10);
  const current = Math.min(active, Math.max(0, side.length - 1));
  const chosen = configured[current] ?? null;
  const promo = chosen?.item.promo ?? null;
  const category = side[current];
  if (!category) return null;
  const subs = children(category.id);

  return (
    <div className="tk-mega as-sm" data-promo={promo ? "" : undefined} role="dialog" aria-label={t.allCategories}>
      <div className="tk-mega-side">
        {side.map((c, i) => (
          <StoreLink key={c.id} href={categoryHref(c)} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} data-on={i === current ? "" : undefined} onClick={onClose}>
            {c.name}
            <ChevronLeft className="size-3.5 opacity-60" aria-hidden />
          </StoreLink>
        ))}
      </div>
      <div className="grid content-start gap-2 @5xl:grid-cols-2">
        {chosen && chosen.item.columns.length ? (
          chosen.item.columns.map((column, c) => (
            <div key={c} className="tk-mega-col">
              <h3>{column.title}</h3>
              <ul>
                {column.links.map((link, l) => (
                  <li key={l}>
                    <StoreLink href={data.links[`mega:${chosen.i}:${c}:${l}`] ?? null} onClick={onClose}>
                      {link.label}
                    </StoreLink>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <div className="tk-mega-col">
            <h3>{category.name}</h3>
            <ul>
              {subs.map((s) => (
                <li key={s.id}>
                  <StoreLink href={categoryHref(s)} onClick={onClose}>
                    {s.name}
                  </StoreLink>
                </li>
              ))}
              <li>
                <StoreLink href={categoryHref(category)} className="font-extrabold text-(--as-primary)" onClick={onClose}>
                  {t.viewAll}
                </StoreLink>
              </li>
            </ul>
          </div>
        )}
      </div>
      {promo && chosen ? (
        <StoreLink href={data.links[`mega:${chosen.i}:promo`] ?? null} className="tk-mega-promo" onClick={onClose}>
          {promo.media_id ? <Photo urls={image(promo.media_id)} size="medium" alt={promo.title} className="h-[5.625rem] w-full rounded-[0.625rem]" /> : null}
          <b className="as-base">{promo.title}</b>
          {promo.text ? <span className="as-xs text-slate-300">{promo.text}</span> : null}
        </StoreLink>
      ) : null}
    </div>
  );
}

/** The navy bar: «☰ كل الأقسام» (the mega menu), the top categories, «⚡ عروض اليوم». */
function NavBar() {
  const { settings } = useTekno();
  const { top } = useCategoryTree();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useEscape(open, close);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const mega = settings.mega_menu.enabled && top.length > 0;

  return (
    <div className="tk-nav hidden @3xl:block">
      <div ref={ref} className="tk-wrap relative flex h-[3.125rem] items-center gap-[1.625rem]">
        {mega ? (
          <button type="button" className="tk-all as-sm -ms-8" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Menu className="size-4" aria-hidden />
            {t.allCategories}
          </button>
        ) : (
          <StoreLink href="/products" className="tk-all as-sm -ms-8">
            <Menu className="size-4" aria-hidden />
            {t.allCategories}
          </StoreLink>
        )}
        <nav className="as-sm flex min-w-0 items-center gap-[1.625rem] overflow-hidden font-bold" aria-label={t.menu}>
          {top.slice(0, 8).map((c) => (
            <StoreLink key={c.id} href={categoryHref(c)}>
              {c.name}
            </StoreLink>
          ))}
          <StoreLink href="/offers" className="tk-hot flex items-center gap-1">
            <Zap className="size-4 fill-current" aria-hidden />
            {t.todayOffers}
          </StoreLink>
        </nav>
        {open ? <MegaMenu onClose={close} /> : null}
      </div>
    </div>
  );
}

/** The phone menu: every category with the ones under it, all products, today's offers. */
function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { top, children } = useCategoryTree();
  const [expanded, setExpanded] = React.useState<number | null>(null);
  useEscape(open, onClose);
  return (
    <div className="tk-drawer fixed inset-0 z-[60] flex @3xl:hidden" data-open={open ? "" : undefined} role="dialog" aria-modal="true" aria-label={t.menu} aria-hidden={!open} inert={!open}>
      <button type="button" className="tk-drawer-shade absolute inset-0 bg-black/50" onClick={onClose} aria-label={t.closeMenu} />
      <div className="tk-drawer-panel relative flex h-full w-[min(22rem,88%)] flex-col overflow-y-auto overscroll-contain bg-white text-(--as-text) shadow-2xl">
        <div className="tk-head flex items-center justify-between px-4 py-3">
          <Logo small />
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-lg" aria-label={t.closeMenu}>
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex flex-col px-4 py-2" aria-label={t.menu}>
          <StoreLink href="/products" className="tk-display as-base border-b py-3">
            {t.allProducts}
          </StoreLink>
          {top.map((c) => {
            const subs = children(c.id);
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} className="border-b">
                <div className="flex items-center justify-between">
                  <StoreLink href={categoryHref(c)} className="as-base flex-1 py-3 font-bold">
                    {c.name}
                  </StoreLink>
                  {subs.length ? (
                    <button type="button" onClick={() => setExpanded(isOpen ? null : c.id)} className="flex size-10 items-center justify-center" aria-expanded={isOpen} aria-label={c.name}>
                      <ChevronDown className={cn("size-4 transition", isOpen && "rotate-180")} aria-hidden />
                    </button>
                  ) : null}
                </div>
                {isOpen ? (
                  <ul className="as-sm flex flex-col gap-2 pb-3 ps-3 as-muted">
                    {subs.map((s) => (
                      <li key={s.id}>
                        <StoreLink href={categoryHref(s)}>{s.name}</StoreLink>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
          <StoreLink href="/offers" className="as-base flex items-center gap-1.5 border-b py-3 font-extrabold text-(--as-primary)">
            <Zap className="size-4" aria-hidden />
            {t.todayOffers}
          </StoreLink>
          <StoreLink href="/track" className="as-sm py-3 font-bold as-muted">
            {t.track}
          </StoreLink>
        </nav>
      </div>
    </div>
  );
}

/** The dark strip: the announcement, then «تابع طلبك · الخط الساخن» (computers). */
function Strip() {
  const { settings } = useTekno();
  const h = settings.header;
  const end = h.track_link || h.hotline;
  if (!h.announcement && !end) return null;
  return (
    <div className="tk-strip as-xs">
      <div className="tk-wrap flex min-h-9 items-center justify-center gap-4 py-1.5 @3xl:justify-between">
        {h.announcement ? <p className="truncate text-center">{h.announcement}</p> : <span />}
        {end ? (
          <p className="hidden shrink-0 items-center gap-1.5 @3xl:flex">
            {h.track_link ? <StoreLink href="/track">{t.track}</StoreLink> : null}
            {h.track_link && h.hotline ? <span aria-hidden>·</span> : null}
            {h.hotline ? (
              <a href={telLink(h.hotline)} dir="auto">
                {t.hotline(h.hotline)}
              </a>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The strip, the navy header (logo, search, tools) and its nav bar; on a phone: ☰ logo cart, then the search. */
export function Header() {
  const { settings } = useTekno();
  const [open, setOpen] = React.useState(false);
  const closeMenu = React.useCallback(() => setOpen(false), []);
  const cart = useLiveCount(cartCount(useCart()));
  const h = settings.header;

  return (
    <header className={cn("z-40", h.sticky && "sticky top-0")}>
      <Strip />
      <div className="tk-head">
        <div className="tk-wrap hidden h-[4.875rem] items-center gap-[1.625rem] @3xl:flex">
          <Logo />
          {h.search ? <SearchForm /> : <span className="flex-1" />}
          <Tools />
        </div>
        <div className="tk-wrap flex flex-col gap-2.5 py-3 @3xl:hidden">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <button type="button" onClick={() => setOpen(true)} className="flex size-9 items-center justify-center" aria-label={t.openMenu}>
              <Menu className="size-5" />
            </button>
            <div className="flex min-w-0 justify-center">
              <Logo small />
            </div>
            <StoreLink href="/cart" className="relative flex size-9 items-center justify-center" aria-label={cart > 0 ? t.count(t.cart, cart) : t.cart}>
              <ShoppingCart className="size-5" aria-hidden />
              <Badge n={cart} />
            </StoreLink>
          </div>
          {h.search ? <SearchForm compact /> : null}
        </div>
      </div>
      <NavBar />
      <Drawer open={open} onClose={closeMenu} />
    </header>
  );
}

/** The phone's bottom bar: الرئيسية / الأقسام / قارن / السلة / حسابي (the last thing of the page, stuck to the bottom). */
export function BottomNav() {
  const { mode } = useTekno();
  const hydrated = useHydrated();
  const [open, setOpen] = React.useState(false);
  const closeMenu = React.useCallback(() => setOpen(false), []);
  const compare = useLiveCount(useCompare().count);
  const cart = useLiveCount(cartCount(useCart()));
  // The page the visitor is on (the Builder previews the home).
  const path = hydrated && mode === "live" ? window.location.pathname : "/";
  const item = "relative flex flex-col items-center gap-0.5 py-2 font-extrabold";
  const current = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const links = [
    { href: "/compare", label: t.compare, icon: ArrowLeftRight, n: compare },
    { href: "/cart", label: t.cart, icon: ShoppingCart, n: cart },
    { href: "/account", label: t.account, icon: UserRound, n: 0 },
  ];
  return (
    <>
      <nav className="tk-bottom as-xs grid grid-cols-5 @3xl:hidden" aria-label={t.menu}>
        <StoreLink href="/" className={item} aria-current={current("/") ? "page" : undefined}>
          <House className="size-[1.375rem]" strokeWidth={1.8} aria-hidden />
          {t.home}
        </StoreLink>
        <button type="button" className={item} onClick={() => setOpen(true)} aria-haspopup="dialog">
          <LayoutGrid className="size-[1.375rem]" strokeWidth={1.8} aria-hidden />
          {t.menu}
        </button>
        {links.map(({ href, label, icon: Icon, n }) => (
          <StoreLink key={href} href={href} className={item} aria-current={current(href) ? "page" : undefined} aria-label={n > 0 ? t.count(label, n) : undefined}>
            <span className="relative">
              <Icon className="size-[1.375rem]" strokeWidth={1.8} aria-hidden />
              <Badge n={n} />
            </span>
            {label}
          </StoreLink>
        ))}
      </nav>
      <Drawer open={open} onClose={closeMenu} />
    </>
  );
}

/** About, «الأقسام», «المساعدة», «تواصل معانا», «طرق الدفع»; then «© {year} {store} · صنع بواسطة مكسب». */
export function Footer() {
  const { settings, data, storeName } = useTekno();
  const shop = useShop();
  const { top } = useCategoryTree();
  const f = settings.footer;
  const year = new Date().getFullYear();
  const socials = SOCIALS.filter((n) => f.social[n]);
  // The chosen help pages in their order (none chosen: the store's pages).
  const chosen = (f.help_links ?? []).map((id) => data.pages.find((p) => p.id === id)).filter((p) => p !== undefined);
  const pages = chosen.length ? chosen : f.show_pages ? data.pages : [];
  // The live store's own ways to pay (the Builder shows cash on delivery alone), and installments when on.
  const payments = [...(shop?.config.payments ? [...(shop.config.payments.cod ? [t.footer.cod] : []), ...shop.config.payments.methods.map((m) => m.name)] : [t.footer.cod]), ...(settings.installments?.enabled ? [t.footer.installments] : [])];
  const contact = f.phone || f.whatsapp || f.email || f.address;

  return (
    <footer className="tk-foot mt-5">
      <div className="tk-wrap as-sm grid grid-cols-2 gap-x-6 gap-y-8 pb-6 pt-10 @3xl:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr] @3xl:gap-[1.625rem]">
        <div className="col-span-2 flex flex-col gap-3 @3xl:col-span-1">
          <span className="text-white">
            <Logo />
          </span>
          {f.about ? <p className="leading-loose">{f.about}</p> : null}
          {socials.length ? (
            <div className="flex gap-2">
              {socials.map((n) => (
                <a key={n} href={f.social[n] ?? "#"} target="_blank" rel="noopener noreferrer" className="flex size-9 items-center justify-center rounded-lg bg-[#1e293b] transition hover:text-white" aria-label={n}>
                  <SocialIcon network={n} className="size-4" />
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <h3>{t.footer.categories}</h3>
          <ul className="flex flex-col leading-loose">
            {top.slice(0, 6).map((c) => (
              <li key={c.id}>
                <StoreLink href={categoryHref(c)}>{c.name}</StoreLink>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>{t.footer.help}</h3>
          <ul className="flex flex-col leading-loose">
            <li>
              <StoreLink href="/track">{t.track}</StoreLink>
            </li>
            {pages.map((p) => (
              <li key={p.slug}>
                <StoreLink href={`/pages/${encodeURIComponent(p.slug)}`}>{p.title}</StoreLink>
              </li>
            ))}
          </ul>
        </div>
        {contact ? (
          <div>
            <h3>{t.footer.contact}</h3>
            <ul className="flex flex-col leading-loose">
              {f.phone ? (
                <li>
                  <a href={telLink(f.phone)} className="flex items-center gap-2" dir="ltr">
                    <Phone className="size-3.5 shrink-0" aria-hidden />
                    {f.phone}
                  </a>
                </li>
              ) : null}
              {f.whatsapp ? (
                <li>
                  <a href={whatsappLink(f.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <WhatsAppIcon className="size-3.5 shrink-0" />
                    {t.footer.whatsapp}
                  </a>
                </li>
              ) : null}
              {f.email ? (
                <li>
                  <a href={`mailto:${f.email}`} className="flex items-center gap-2">
                    <Mail className="size-3.5 shrink-0" aria-hidden />
                    {f.email}
                  </a>
                </li>
              ) : null}
              {f.address ? (
                <li className="flex items-start gap-2">
                  <MapPin className="mt-1.5 size-3.5 shrink-0" aria-hidden />
                  {f.address}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
        <div className={cn(!contact && "@3xl:col-start-5")}>
          <h3>{t.footer.payments}</h3>
          <ul className="tk-pay flex flex-wrap gap-1.5">
            {payments.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="tk-wrap">
        <p className="as-xs border-t py-4">
          {t.footer.rights(storeName, year)} · {t.footer.madeWith}
        </p>
      </div>
    </footer>
  );
}

/** The WhatsApp button at the corner (on a phone, above the bottom bar). */
export function Floaters() {
  const { settings } = useTekno();
  const f = settings.footer;
  const wa = settings.general.whatsapp_button && f.whatsapp ? whatsappLink(f.whatsapp) : null;
  if (!wa) return null;
  return (
    <a href={wa} target="_blank" rel="noopener noreferrer" className="fixed bottom-[4.75rem] end-5 z-[35] @3xl:bottom-5 flex size-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-xl [[data-mode=builder]_&]:absolute" aria-label={t.whatsapp}>
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
