"use client";

import { Mail, MapPin, Menu, Phone, Search, ShoppingBag, UserRound, X } from "lucide-react";
import * as React from "react";
import { cartCount, useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { pick, SOCIALS } from "@/themes/shared/design";
import { telLink, whatsappLink } from "@/themes/store/shared/contact";
import { StoreLink, useHydrated } from "@/themes/store/shared/context";
import { useShop } from "@/themes/store/shared/shop";
import { SocialIcon, WhatsAppIcon } from "../asas/icons";
import { useRawaq } from "./root";

const t = ar.rawaqStore;

function Logo({ small = false }: { small?: boolean }) {
  const { settings, data, media, storeName } = useRawaq();
  const id = settings.logo_media_id;
  const logo = id ? pick(media[String(id)] ?? data.media[String(id)], "medium") : null;
  return (
    <StoreLink href="/" className="flex min-w-0 items-center">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- store logo from the media server
        <img src={logo} alt={storeName} className={cn("w-auto object-contain", small ? "h-8 max-w-[9rem]" : "h-10 max-w-[10rem] @5xl:h-12 @5xl:max-w-[12rem]")} />
      ) : (
        <span className={cn("rq-display truncate text-(--as-primary)", small ? "as-xl" : "as-2xl @5xl:as-3xl")}>{storeName}</span>
      )}
    </StoreLink>
  );
}

function IconButton({ label, href, onClick, children }: { label: string; href?: string; onClick?: () => void; children: React.ReactNode }) {
  return href ? (
    <StoreLink href={href} className="rq-icon" aria-label={label}>
      {children}
    </StoreLink>
  ) : (
    <button type="button" onClick={onClick} className="rq-icon" aria-label={label}>
      {children}
    </button>
  );
}

function CartLink() {
  const { mode } = useRawaq();
  const count = cartCount(useCart());
  const shown = useHydrated() && mode === "live" && count > 0;
  return (
    <IconButton href="/cart" label={shown ? `${t.cart} (${count})` : t.cart}>
      <ShoppingBag className="size-5" />
      {shown ? (
        <span className="as-xs absolute -end-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-(--as-primary) px-1 font-bold text-(--as-on-primary)" aria-hidden>
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </IconButton>
  );
}

/** The categories inline in the header (computers), «العروض» last. */
function Nav() {
  const { data } = useRawaq();
  const top = data.categories.filter((c) => c.parent_id === null).slice(0, 6);
  return (
    <nav className="rq-nav as-sm hidden items-center gap-5 font-bold @5xl:flex" aria-label={t.menu}>
      <StoreLink href="/products" className="hover:text-(--as-primary)">
        {t.allProducts}
      </StoreLink>
      {top.map((c) => (
        <StoreLink key={c.id} href={`/categories/${encodeURIComponent(c.slug)}`} className="hover:text-(--as-primary)">
          {c.name}
        </StoreLink>
      ))}
      <StoreLink href="/offers" className="text-(--as-primary)">
        {t.offers}
      </StoreLink>
    </nav>
  );
}

function SearchBox({ onClose }: { onClose: () => void }) {
  const { mode } = useRawaq();
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col" role="dialog" aria-modal="true" aria-label={t.search}>
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label={t.closeSearch} />
      <div className="rq-search-panel relative bg-(--as-bg) text-(--as-text) shadow-2xl">
        <form role="search" action="/products" className="rq-wrap flex items-center gap-2 py-4" onSubmit={(e) => mode !== "live" && e.preventDefault()}>
          <label className="flex h-12 flex-1 items-center gap-2 rounded-full border bg-(--rq-blush) px-4">
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

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useRawaq();
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div className="rq-drawer fixed inset-0 z-[60] flex @5xl:hidden" data-open={open ? "" : undefined} role="dialog" aria-modal="true" aria-label={t.menu} aria-hidden={!open} inert={!open}>
      <button type="button" className="rq-drawer-shade absolute inset-0 bg-black/40" onClick={onClose} aria-label={t.closeMenu} />
      <div className="rq-drawer-panel relative flex h-full w-[min(22rem,88%)] flex-col overflow-y-auto overscroll-contain bg-(--as-bg) p-5 text-(--as-text) shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <Logo small />
          <IconButton label={t.closeMenu} onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <StoreLink href="/products" className="rq-display as-xl border-b py-3">
          {t.allProducts}
        </StoreLink>
        {data.categories
          .filter((c) => c.parent_id === null)
          .map((c) => (
            <StoreLink key={c.id} href={`/categories/${encodeURIComponent(c.slug)}`} className="as-base border-b py-3 font-bold">
              {c.name}
            </StoreLink>
          ))}
        <StoreLink href="/offers" className="as-base border-b py-3 font-extrabold text-(--as-primary)">
          {t.offers}
        </StoreLink>
      </div>
    </div>
  );
}

/** The announcement strip, then the logo (at the start or in the middle), the categories, search, account and cart. */
export function Header() {
  const { settings, mode } = useRawaq();
  const [open, setOpen] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const ref = React.useRef<HTMLElement>(null);
  const h = settings.header;
  const center = h.layout === "center";
  const closeMenu = React.useCallback(() => setOpen(false), []);
  const closeSearch = React.useCallback(() => setSearching(false), []);

  React.useEffect(() => {
    if (mode === "builder") return;
    let box: HTMLElement | null = ref.current?.parentElement ?? null;
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    const target: HTMLElement | Window = box ?? window;
    const onScroll = () => setScrolled((box ? box.scrollTop : window.scrollY) > 30);
    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [mode]);

  const icons = (
    <div className="flex items-center gap-2">
      {h.search ? (
        <IconButton label={t.search} onClick={() => setSearching(true)}>
          <Search className="size-5" />
        </IconButton>
      ) : null}
      <span className="hidden @3xl:block">
        <IconButton href="/account" label={t.account}>
          <UserRound className="size-5" />
        </IconButton>
      </span>
      <CartLink />
    </div>
  );

  return (
    <header ref={ref} className={cn("rq-header", !h.sticky && "!static")} data-scrolled={scrolled ? "" : undefined}>
      {h.announcement ? (
        <div className="rq-strip as-xs @3xl:as-sm">
          <p className="rq-wrap py-2 text-center font-bold">{h.announcement}</p>
        </div>
      ) : null}
      <div className="rq-mainrow">
        {/* A long store name shrinks (truncated) instead of pushing the icons off a phone's screen. */}
        <div className={cn("rq-wrap grid h-full items-center gap-4", center ? "grid-cols-[1fr_minmax(0,auto)_1fr]" : "grid-cols-[minmax(0,1fr)_auto] @5xl:grid-cols-[auto_1fr_auto]")}>
          <div className="flex min-w-0 items-center gap-2">
            <span className="@5xl:hidden">
              <IconButton label={t.openMenu} onClick={() => setOpen(true)}>
                <Menu className="size-5" />
              </IconButton>
            </span>
            {center ? h.categories_menu ? <Nav /> : null : <Logo />}
          </div>
          <div className={cn("min-w-0 items-center justify-center", center ? "flex" : "hidden @5xl:flex")}>{center ? <Logo /> : h.categories_menu ? <Nav /> : null}</div>
          <div className="flex items-center justify-end">{icons}</div>
        </div>
      </div>
      {searching ? <SearchBox onClose={closeSearch} /> : null}
      <Drawer open={open} onClose={closeMenu} />
    </header>
  );
}

/** About and socials, the shop and help menus, contact, the ways to pay; light or dark; then the copyright. */
export function Footer() {
  const { settings, data, storeName } = useRawaq();
  const shop = useShop();
  const f = settings.footer;
  const year = new Date().getFullYear();
  const socials = SOCIALS.filter((n) => f.social[n]);
  const top = data.categories.filter((c) => c.parent_id === null).slice(0, 6);
  // The live store's own ways to pay (the Builder shows cash on delivery alone).
  const payments = shop?.config.payments ? [...(shop.config.payments.cod ? [t.footer.cod] : []), ...shop.config.payments.methods.map((m) => m.name)] : [t.footer.cod];
  return (
    <footer className={cn("mt-auto", f.dark ? "rq-dark" : "rq-sand border-t")}>
      <div className="rq-wrap grid gap-10 py-12 @3xl:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="flex flex-col gap-4">
          <Logo />
          {f.about ? <p className="as-sm as-muted max-w-sm leading-relaxed">{f.about}</p> : null}
          {socials.length ? (
            <div className="flex gap-2">
              {socials.map((n) => (
                <a key={n} href={f.social[n] ?? "#"} target="_blank" rel="noopener noreferrer" className="flex size-10 items-center justify-center rounded-full border transition hover:border-(--as-primary) hover:text-(--as-primary)" aria-label={n}>
                  <SocialIcon network={n} className="size-4" />
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <h3 className="rq-display as-lg mb-3">{t.footer.shop}</h3>
          <ul className="as-sm flex flex-col gap-2 as-muted">
            <li>
              <StoreLink href="/products" className="hover:text-(--as-primary)">
                {t.allProducts}
              </StoreLink>
            </li>
            {top.map((c) => (
              <li key={c.id}>
                <StoreLink href={`/categories/${encodeURIComponent(c.slug)}`} className="hover:text-(--as-primary)">
                  {c.name}
                </StoreLink>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="rq-display as-lg mb-3">{t.footer.help}</h3>
          <ul className="as-sm flex flex-col gap-2 as-muted">
            <li>
              <StoreLink href="/track" className="hover:text-(--as-primary)">
                {t.footer.track}
              </StoreLink>
            </li>
            {f.show_pages
              ? data.pages.map((p) => (
                  <li key={p.slug}>
                    <StoreLink href={`/pages/${encodeURIComponent(p.slug)}`} className="hover:text-(--as-primary)">
                      {p.title}
                    </StoreLink>
                  </li>
                ))
              : null}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          {f.phone || f.whatsapp || f.email || f.address ? (
            <>
              <h3 className="rq-display as-lg">{t.footer.contact}</h3>
              <ul className="as-sm flex flex-col gap-2.5 as-muted">
                {f.phone ? (
                  <li>
                    <a href={telLink(f.phone)} className="flex items-center gap-2 hover:text-(--as-primary)" dir="ltr">
                      <Phone className="size-4 shrink-0" aria-hidden />
                      {f.phone}
                    </a>
                  </li>
                ) : null}
                {f.whatsapp ? (
                  <li>
                    <a href={whatsappLink(f.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-(--as-primary)" dir="ltr">
                      <WhatsAppIcon className="size-4 shrink-0" />
                      {f.whatsapp}
                    </a>
                  </li>
                ) : null}
                {f.email ? (
                  <li>
                    <a href={`mailto:${f.email}`} className="flex items-center gap-2 hover:text-(--as-primary)">
                      <Mail className="size-4 shrink-0" aria-hidden />
                      {f.email}
                    </a>
                  </li>
                ) : null}
                {f.address ? (
                  <li className="flex items-start gap-2">
                    <MapPin className="mt-1 size-4 shrink-0" aria-hidden />
                    {f.address}
                  </li>
                ) : null}
              </ul>
            </>
          ) : null}
          {f.payments ? (
            <div className="flex flex-col gap-2">
              <h3 className="as-sm font-bold">{t.footer.payments}</h3>
              <ul className="as-xs flex flex-wrap gap-2">
                {payments.map((name) => (
                  <li key={name} className="rounded-lg border px-2.5 py-1 font-bold">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-t border-(--as-line)">
        <div className="rq-wrap as-xs flex flex-col justify-between gap-2 py-5 as-muted @3xl:flex-row">
          <span>{t.footer.rights(storeName, year)}</span>
          <span>{t.footer.madeWith}</span>
        </div>
      </div>
    </footer>
  );
}

/** WhatsApp and call buttons at the corner. */
export function Floaters() {
  const { settings } = useRawaq();
  const f = settings.footer;
  const g = settings.general;
  const callNumber = g.call_phone || f.phone;
  const wa = g.whatsapp_button && f.whatsapp ? whatsappLink(f.whatsapp) : null;
  const call = g.floating_call && callNumber ? telLink(callNumber) : null;
  if (!wa && !call) return null;
  return (
    <div className="rq-float fixed bottom-5 end-5 z-[35] flex flex-col gap-3 [[data-mode=builder]_&]:absolute">
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
  );
}
