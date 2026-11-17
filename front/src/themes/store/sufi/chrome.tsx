"use client";

import { ChevronDown, Mail, MapPin, Menu, MessageCircle, Moon, Phone, Search, ShoppingBag, Sun, UserRound, X } from "lucide-react";
import * as React from "react";
import { cartCount, useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { StoreLink, useHydrated, useTheme } from "@/themes/store/shared/context";
import { SocialIcon, WhatsAppIcon } from "../asas/icons";
import { pick, SOCIALS } from "@/themes/shared/design";
import { useScheme } from "./root";
import type { Size, SufiSettings } from "./types";

const t = ar.sufi;

function useSufi() {
  const theme = useTheme();
  return { ...theme, settings: theme.settings as SufiSettings };
}

/** Logo heights per size (header on a phone, header on a wide screen) and the matching name size. */
const LOGO = {
  sm: { img: "h-7 max-w-[8rem] @5xl:h-9 @5xl:max-w-[10rem]", text: "as-lg" },
  md: { img: "h-9 max-w-[10rem] @5xl:h-12 @5xl:max-w-[12rem]", text: "as-xl @5xl:as-2xl" },
  lg: { img: "h-11 max-w-[12rem] @5xl:h-16 @5xl:max-w-[16rem]", text: "as-2xl @5xl:as-3xl" },
} as const;

/** The store logo (its dark-scheme version when there is one), or the store name. */
function useLogo(): string | null {
  const { settings, data, media } = useSufi();
  const { scheme } = useScheme();
  const id = scheme === "dark" && settings.logo_dark_media_id ? settings.logo_dark_media_id : settings.logo_media_id;
  return id ? pick(media[String(id)] ?? data.media[String(id)], "medium") : null;
}

function Logo({ size }: { size?: Size }) {
  const { settings, storeName } = useSufi();
  const logo = useLogo();
  const look = LOGO[size ?? settings.header.logo_size ?? "md"];
  return (
    <StoreLink href="/" className="flex min-w-0 items-center">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- store logo from the media server
        <img src={logo} alt={storeName} className={cn("w-auto object-contain", look.img)} />
      ) : (
        <span className={cn("truncate font-extrabold tracking-tight", look.text)}>{storeName}</span>
      )}
    </StoreLink>
  );
}

/** Stops the page (or the store's own scrolling box in previews) from scrolling; returns the undo. */
function lockScroll(inside: HTMLElement | null): () => void {
  let box: HTMLElement | null = inside?.parentElement ?? null;
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
  const target = box ?? document.documentElement;
  const before = target.style.overflow;
  target.style.overflow = "hidden";
  return () => {
    target.style.overflow = before;
  };
}

/** While open, the page under a drawer or the search doesn't scroll. */
function useScrollLock(locked: boolean, from: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => (locked ? lockScroll(from.current) : undefined), [locked, from]);
}

function IconButton({ label, href, onClick, children }: { label: string; href?: string; onClick?: () => void; children: React.ReactNode }) {
  const cls = "relative flex size-10 items-center justify-center rounded-full transition hover:bg-current/10";
  return href ? (
    <StoreLink href={href} className={cls} aria-label={label}>
      {children}
    </StoreLink>
  ) : (
    <button type="button" onClick={onClick} className={cls} aria-label={label}>
      {children}
    </button>
  );
}

function CartLink() {
  const { mode } = useSufi();
  const count = cartCount(useCart());
  const hydrated = useHydrated();
  const shown = hydrated && mode === "live" && count > 0;
  return (
    <IconButton href="/cart" label={shown ? `${t.cart} (${count})` : t.cart}>
      <ShoppingBag className="size-5" />
      {shown ? (
        <span className="as-xs absolute -end-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-(--as-primary) px-1 font-bold text-(--as-on-primary)" aria-hidden>
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </IconButton>
  );
}

function SchemeSwitch() {
  const { scheme, toggle } = useScheme();
  if (!toggle) return null;
  return (
    <button type="button" onClick={toggle} className="flex items-center rounded-full bg-current/10 p-0.5" aria-label={scheme === "dark" ? t.light : t.dark} aria-pressed={scheme === "dark"}>
      <span className={cn("flex h-7 w-8 items-center justify-center rounded-full transition", scheme === "light" && "bg-(--as-bg) text-(--as-text) shadow-sm")}>
        <Sun className="size-4" aria-hidden />
      </span>
      <span className={cn("flex h-7 w-8 items-center justify-center rounded-full transition", scheme === "dark" && "bg-(--as-primary) text-(--as-on-primary)")}>
        <Moon className="size-3.5" aria-hidden />
      </span>
    </button>
  );
}

function NavLinks({ className }: { className?: string }) {
  const { data } = useSufi();
  const top = data.categories.filter((c) => c.parent_id === null);
  const children = (id: number) => data.categories.filter((c) => c.parent_id === id);
  return (
    <nav className={className} aria-label={t.menu}>
      <StoreLink href="/products" className="as-sm px-3 py-2 font-bold hover:opacity-70">
        {t.allProducts}
      </StoreLink>
      {top.slice(0, 7).map((c) => (
        <div key={c.id} className="group relative">
          <StoreLink href={`/categories/${encodeURIComponent(c.slug)}`} className="as-sm flex items-center gap-1 px-3 py-2 font-bold hover:opacity-70">
            {c.name}
            {children(c.id).length ? <ChevronDown className="size-3.5" aria-hidden /> : null}
          </StoreLink>
          {children(c.id).length ? (
            <div className="invisible absolute start-0 top-full z-50 min-w-48 rounded-2xl border bg-(--as-bg) p-2 text-(--as-text) opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              {children(c.id).map((sub) => (
                <StoreLink key={sub.id} href={`/categories/${encodeURIComponent(sub.slug)}`} className="as-sm block rounded-xl px-3 py-2 hover:bg-(--sf-soft)">
                  {sub.name}
                </StoreLink>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      <StoreLink href="/offers" className="as-sm px-3 py-2 font-bold text-(--as-primary) hover:opacity-70">
        {t.offers}
      </StoreLink>
    </nav>
  );
}

/** Search on top of everything: the store dims, the box takes the focus, Escape or a tap outside closes it. */
function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { mode } = useSufi();
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sf-search fixed inset-0 z-[70] flex flex-col" role="dialog" aria-modal="true" aria-label={t.search}>
      <button type="button" className="sf-search-shade absolute inset-0 bg-black/45" onClick={onClose} aria-label={t.closeSearch} />
      <div className="sf-search-panel relative bg-(--as-bg) text-(--as-text) shadow-2xl">
        <form role="search" action="/products" className="sf-wrap flex items-center gap-2 py-4" onSubmit={(e) => mode !== "live" && e.preventDefault()}>
          <label className="flex h-12 flex-1 items-center gap-2 rounded-full border bg-(--sf-surface) px-4">
            <Search className="size-4 shrink-0 opacity-60" aria-hidden />
            <input name="q" type="search" autoFocus placeholder={t.searchPlaceholder} aria-label={t.search} className="as-sm w-full bg-transparent outline-none" />
          </label>
          <IconButton label={t.closeSearch} onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </form>
      </div>
    </div>
  );
}

/** The phone menu: slides in from the side and out again (sufi.css); the page behind stays still. */
function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useSufi();
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div className="sf-drawer fixed inset-0 z-[60] flex @5xl:hidden" data-open={open ? "" : undefined} role="dialog" aria-modal="true" aria-label={t.menu} aria-hidden={!open} inert={!open}>
      <button type="button" className="sf-drawer-shade absolute inset-0 bg-black/40" onClick={onClose} aria-label={t.closeMenu} />
      <div className="sf-drawer-panel relative flex h-full w-[min(22rem,88%)] flex-col overflow-y-auto overscroll-contain bg-(--as-bg) p-5 text-(--as-text) shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <Logo size="sm" />
          <IconButton label={t.closeMenu} onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <StoreLink href="/products" className="as-base border-b py-3 font-bold">
          {t.allProducts}
        </StoreLink>
        {data.categories
          .filter((c) => c.parent_id === null)
          .map((c) => (
            <div key={c.id} className="border-b py-2">
              <StoreLink href={`/categories/${encodeURIComponent(c.slug)}`} className="as-base block py-1 font-bold">
                {c.name}
              </StoreLink>
              {data.categories
                .filter((sub) => sub.parent_id === c.id)
                .map((sub) => (
                  <StoreLink key={sub.id} href={`/categories/${encodeURIComponent(sub.slug)}`} className="as-sm block py-1 ps-4 opacity-70">
                    {sub.name}
                  </StoreLink>
                ))}
            </div>
          ))}
        <StoreLink href="/offers" className="as-base border-b py-3 font-bold text-(--as-primary)">
          {t.offers}
        </StoreLink>
        <div className="mt-6">
          <SchemeSwitch />
        </div>
      </div>
    </div>
  );
}

/**
 * Top bar (contacts + announcement), logo in the middle or on a side, the menu, search, the
 * light / dark switch, account and cart. Over a hero set to "merge" it is transparent until the
 * page scrolls (sufi.css).
 */
export function Header() {
  const { settings, mode } = useSufi();
  const [open, setOpen] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const ref = React.useRef<HTMLElement>(null);
  const layout = settings.header.layout;
  const f = settings.footer;
  const closeMenu = React.useCallback(() => setOpen(false), []);
  const closeSearch = React.useCallback(() => setSearching(false), []);
  useScrollLock(open || searching, ref);

  React.useEffect(() => {
    if (mode === "builder") return;
    // The page scrolls, or a box around the store (the theme's showcase, a preview frame).
    let box: HTMLElement | null = ref.current?.parentElement ?? null;
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    const target: HTMLElement | Window = box ?? window;
    const onScroll = () => setScrolled((box ? box.scrollTop : window.scrollY) > 40);
    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [mode]);

  const tools = (
    <div className="flex items-center gap-0.5">
      {settings.header.search ? (
        <IconButton label={t.search} onClick={() => setSearching((s) => !s)}>
          <Search className="size-5" />
        </IconButton>
      ) : null}
      <div className="hidden @3xl:block">
        <SchemeSwitch />
      </div>
    </div>
  );
  const account = (
    <div className="flex items-center gap-0.5">
      <IconButton href="/account" label={t.account}>
        <UserRound className="size-5" />
      </IconButton>
      <CartLink />
    </div>
  );

  return (
    <header ref={ref} className={cn("sf-header", scrolled && "sf-scrolled", !settings.header.sticky && "!static")}>
      {settings.header.topbar ? (
        <div className="sf-topbar sf-hline hidden @3xl:block">
          <div className="sf-wrap as-xs flex h-full items-center justify-between gap-6 opacity-85">
            <div className="flex items-center gap-5">
              {f.phone ? (
                <a href={`tel:${f.phone}`} className="flex items-center gap-1.5" dir="ltr">
                  <Phone className="size-3.5" aria-hidden />
                  {f.phone}
                </a>
              ) : null}
              {f.email ? (
                <a href={`mailto:${f.email}`} className="flex items-center gap-1.5">
                  <Mail className="size-3.5" aria-hidden />
                  {f.email}
                </a>
              ) : null}
            </div>
            {settings.header.announcement ? <p className="truncate font-semibold">{settings.header.announcement}</p> : null}
          </div>
        </div>
      ) : settings.header.announcement ? (
        <p className="as-xs hidden bg-(--as-primary) px-4 py-2 text-center font-semibold text-(--as-on-primary) @3xl:block">{settings.header.announcement}</p>
      ) : null}

      <div className={cn("sf-mainrow", layout !== "center" && "sf-hline")}>
        <div className="sf-wrap grid h-full grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="flex items-center @5xl:hidden">
              <IconButton label={t.menu} onClick={() => setOpen(true)}>
                <Menu className="size-5" />
              </IconButton>
              {/* Phones: the search sits next to the menu (the desktop tools are hidden there). */}
              {settings.header.search && layout !== "start" ? (
                <IconButton label={t.search} onClick={() => setSearching(true)}>
                  <Search className="size-5" />
                </IconButton>
              ) : null}
            </span>
            {layout === "center" ? <span className="hidden @5xl:block">{tools}</span> : layout === "start" ? <span className="hidden @5xl:block"><Logo /></span> : <span className="hidden @5xl:block">{account}</span>}
          </div>
          <div className="flex justify-center">
            {layout === "center" ? <Logo /> : <><span className="@5xl:hidden"><Logo /></span><NavLinks className="hidden items-center @5xl:flex" /></>}
          </div>
          <div className="flex items-center justify-end gap-1">
            {layout === "center" ? account : layout === "start" ? <>{tools}{account}</> : <><span className="hidden @5xl:block">{tools}</span><span className="hidden @5xl:block"><Logo /></span><span className="@5xl:hidden">{account}</span></>}
          </div>
        </div>
      </div>
      {layout === "center" ? (
        <div className="sf-navrow sf-hline hidden @5xl:block">
          <NavLinks className="sf-wrap flex h-full items-center justify-center gap-2" />
        </div>
      ) : null}

      {searching ? <SearchOverlay onClose={closeSearch} /> : null}
      <MenuDrawer open={open} onClose={closeMenu} />
    </header>
  );
}

const FOOTER_LOGO: Record<Size, string> = {
  sm: "h-8 max-w-[9rem]",
  md: "h-11 max-w-[12rem]",
  lg: "h-16 max-w-[16rem]",
};

/** A number written by the merchant → a wa.me link (Egyptian 01… numbers get +20). */
function whatsappLink(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, "").replace(/^0/, "20")}`;
}

export function Footer() {
  const { settings, data, media, storeName } = useSufi();
  const f = settings.footer;
  const socials = SOCIALS.filter((n) => f.social[n]);
  const top = data.categories.filter((c) => c.parent_id === null).slice(0, 5);
  const wa = f.whatsapp ? whatsappLink(f.whatsapp) : null;
  const year = new Date().getFullYear();
  // The footer is always dark: the dark-scheme logo fits it best when there is one.
  const logoId = settings.logo_dark_media_id || settings.logo_media_id;
  const logo = logoId ? pick(media[String(logoId)] ?? data.media[String(logoId)], "medium") : null;
  const showLogo = f.logo ?? true;
  // «تواصل معانا» only when there is something to show in it.
  const hasContact = Boolean(f.phone || f.email || f.address);

  return (
    <footer className="mt-auto bg-[#141518] text-[#d8d6d1]">
      <div className="sf-wrap">
        {wa ? (
          <div className="flex flex-col items-start justify-between gap-4 border-b border-white/10 py-10 @3xl:flex-row @3xl:items-center">
            <div>
              <p className="as-xl font-extrabold text-white">{t.footer.joinTitle}</p>
              <p className="as-sm mt-1 text-[#9c9a95]">{t.footer.joinText}</p>
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="sf-btn bg-[#25d366] text-[#0b2b17]">
              <MessageCircle className="size-5" aria-hidden />
              {t.whatsapp}
            </a>
          </div>
        ) : null}
        <div className={cn("grid gap-10 py-12", hasContact ? "@3xl:grid-cols-[1.4fr_1fr_1fr_1.2fr]" : "@3xl:grid-cols-[1.6fr_1fr_1fr]")}>
          <div>
            {logo && showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- store logo from the media server
              <img src={logo} alt={storeName} className={cn("w-auto object-contain", FOOTER_LOGO[f.logo_size ?? "md"])} />
            ) : (
              <p className="as-2xl font-extrabold text-white">{storeName}</p>
            )}
            {f.about ? <p className="as-sm mt-4 leading-8 text-[#9c9a95]">{f.about}</p> : null}
            {socials.length ? (
              <div className="mt-5 flex gap-2">
                {socials.map((n) => (
                  <a key={n} href={f.social[n]!} target="_blank" rel="noopener noreferrer" className="flex size-10 items-center justify-center rounded-full border border-white/15 hover:bg-white/10" aria-label={n}>
                    <SocialIcon network={n} className="size-4" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <p className="as-base mb-4 font-bold text-white">{t.footer.shop}</p>
            <ul className="as-sm flex flex-col gap-3 text-[#9c9a95]">
              <li>
                <StoreLink href="/products">{t.allProducts}</StoreLink>
              </li>
              {top.map((c) => (
                <li key={c.id}>
                  <StoreLink href={`/categories/${encodeURIComponent(c.slug)}`}>{c.name}</StoreLink>
                </li>
              ))}
              <li>
                <StoreLink href="/offers">{t.offers}</StoreLink>
              </li>
            </ul>
          </div>
          <div>
            <p className="as-base mb-4 font-bold text-white">{t.footer.help}</p>
            <ul className="as-sm flex flex-col gap-3 text-[#9c9a95]">
              <li>
                <StoreLink href="/track">{t.footer.track}</StoreLink>
              </li>
              {settings.footer.show_pages
                ? data.pages.map((p) => (
                    <li key={p.slug}>
                      <StoreLink href={`/pages/${encodeURIComponent(p.slug)}`}>{p.title}</StoreLink>
                    </li>
                  ))
                : null}
            </ul>
          </div>
          {hasContact ? (
          <div>
            <p className="as-base mb-4 font-bold text-white">{t.footer.contact}</p>
            <ul className="as-sm flex flex-col gap-3 text-[#9c9a95]">
              {f.phone ? (
                <li className="flex items-center gap-2">
                  <Phone className="size-4" aria-hidden />
                  <a href={`tel:${f.phone}`} dir="ltr">
                    {f.phone}
                  </a>
                </li>
              ) : null}
              {f.email ? (
                <li className="flex items-center gap-2">
                  <Mail className="size-4" aria-hidden />
                  <a href={`mailto:${f.email}`}>{f.email}</a>
                </li>
              ) : null}
              {f.address ? (
                <li className="flex items-start gap-2">
                  <MapPin className="mt-1 size-4 shrink-0" aria-hidden />
                  {f.address}
                </li>
              ) : null}
            </ul>
          </div>
          ) : null}
        </div>
        <div className="as-xs flex flex-col justify-between gap-2 border-t border-white/10 py-5 text-[#7d7c78] @3xl:flex-row">
          <span>{t.footer.rights(storeName, year)}</span>
          <span>{t.footer.madeWith}</span>
        </div>
      </div>
    </footer>
  );
}

/** WhatsApp and call buttons on the side, and the offers tab on the other side. */
export function Floaters() {
  const { settings, data } = useSufi();
  const f = settings.footer;
  const g = settings.general;
  // Their own numbers when set, else the footer's.
  const waNumber = g.whatsapp_number || f.whatsapp;
  const callNumber = g.call_phone || f.phone;
  const wa = g.whatsapp_button && waNumber ? whatsappLink(waNumber) : null;
  const call = g.floating_call && callNumber ? `tel:${callNumber.replace(/[^\d+]/g, "")}` : null;
  const tab = g.offers_tab.enabled && g.offers_tab.label ? data.links.offers_tab ?? "/offers" : null;
  return (
    <>
      {wa || call ? (
        <div className="sf-float">
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex size-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-xl" aria-label={t.whatsapp}>
              <WhatsAppIcon className="size-7" />
            </a>
          ) : null}
          {call ? (
            <a href={call} className="flex size-14 items-center justify-center rounded-full bg-(--as-text) text-(--as-bg) shadow-xl" aria-label={t.call}>
              <Phone className="size-5" aria-hidden />
            </a>
          ) : null}
        </div>
      ) : null}
      {tab ? (
        <StoreLink href={tab} className="sf-offers-tab as-sm bg-(--as-primary) px-2.5 py-4 font-bold text-(--as-on-primary) shadow-lg">
          {g.offers_tab.label}
        </StoreLink>
      ) : null}
    </>
  );
}
