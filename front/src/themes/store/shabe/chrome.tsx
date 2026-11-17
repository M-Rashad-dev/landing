"use client";

import { Banknote, Clock3, Mail, MapPin, Menu, Phone, Search, ShoppingBag, UserRound, X } from "lucide-react";
import * as React from "react";
import { cartCount, useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { pick, SOCIALS } from "@/themes/shared/design";
import { telLink, whatsappLink } from "@/themes/store/shared/contact";
import { StoreLink, useHydrated } from "@/themes/store/shared/context";
import { pad, timeLeft, useNow } from "@/themes/store/shared/use-countdown";
import { SocialIcon, WhatsAppIcon } from "../asas/icons";
import { useShabe } from "./root";

const t = ar.shabeStore;

function Logo({ small = false }: { small?: boolean }) {
  const { settings, data, media, storeName } = useShabe();
  const id = settings.logo_media_id;
  const logo = id ? pick(media[String(id)] ?? data.media[String(id)], "medium") : null;
  return (
    <StoreLink href="/" className="flex min-w-0 items-center">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- store logo from the media server
        <img src={logo} alt={storeName} className={cn("w-auto object-contain", small ? "h-8 max-w-[9rem]" : "h-10 max-w-[10rem] @5xl:h-12 @5xl:max-w-[12rem]")} />
      ) : (
        <span className={cn("ss-display truncate", small ? "as-xl" : "as-2xl @5xl:as-3xl")}>{storeName}</span>
      )}
    </StoreLink>
  );
}

function IconButton({ label, href, onClick, children }: { label: string; href?: string; onClick?: () => void; children: React.ReactNode }) {
  const cls = "relative flex size-10 items-center justify-center rounded-full transition hover:bg-(--ss-soft)";
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
  const { mode } = useShabe();
  const count = cartCount(useCart());
  const shown = useHydrated() && mode === "live" && count > 0;
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

/** The dark strip on top: the announcement and, when set, the offer's countdown. */
function Strip() {
  const { settings, mode } = useShabe();
  const h = settings.header;
  const now = useNow(mode !== "builder");
  const left = h.countdown_ends_at ? timeLeft(h.countdown_ends_at, now) : null;
  const counting = h.countdown_ends_at && !(left?.ended ?? false);
  if (!h.announcement && !counting) return null;
  return (
    <div className="ss-strip as-xs @3xl:as-sm">
      <div className="ss-wrap flex min-h-9 flex-wrap items-center justify-center gap-x-4 gap-y-1 py-1.5 text-center font-bold">
        {h.announcement ? <span>{h.announcement}</span> : null}
        {counting ? (
          <span className="flex items-center gap-1.5" aria-live="off">
            <Clock3 className="size-3.5" aria-hidden />
            {t.endsIn}
            <b dir="ltr" className="tabular-nums">
              {left ? `${left.days ? `${left.days}d ` : ""}${pad(left.hours)}:${pad(left.minutes)}:${pad(left.seconds)}` : "--:--:--"}
            </b>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function OrderButton({ className }: { className?: string }) {
  const { settings, data } = useShabe();
  if (!settings.header.button_label) return null;
  return (
    <StoreLink href={data.links.header_button ?? "/products"} className={cn("ss-btn ss-btn-fire as-sm h-10", className)}>
      {settings.header.button_label}
    </StoreLink>
  );
}

function Hotline() {
  const { settings } = useShabe();
  const number = settings.header.hotline;
  if (!number) return null;
  return (
    <a href={telLink(number)} className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-(--ss-soft)">
      <span className="flex size-9 items-center justify-center rounded-full bg-(--ss-soft) text-(--as-primary)">
        <Phone className="size-4" aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="as-xs as-muted">{t.hotline}</span>
        <b className="as-sm" dir="ltr">
          {number}
        </b>
      </span>
    </a>
  );
}

/** The categories row under the header (the merchant can turn it off): the whole menu, then each category. */
function CategoriesRow() {
  const { data } = useShabe();
  const top = data.categories.filter((c) => c.parent_id === null);
  return (
    <nav className="ss-cats hidden @3xl:block" aria-label={t.menu}>
      <div className="ss-wrap flex h-12 items-center gap-1 overflow-x-auto">
        <StoreLink href="/products" className="as-sm flex items-center gap-2 rounded-full px-3 py-1.5 font-extrabold hover:bg-(--as-bg)">
          <span className="ss-chip-tick" aria-hidden />
          {t.allProducts}
        </StoreLink>
        {top.slice(0, 10).map((c) => (
          <StoreLink key={c.id} href={`/categories/${encodeURIComponent(c.slug)}`} className="as-sm rounded-full px-3 py-1.5 font-bold hover:bg-(--as-bg)">
            {c.name}
          </StoreLink>
        ))}
        <StoreLink href="/offers" className="as-sm ms-auto rounded-full px-3 py-1.5 font-extrabold text-(--as-primary) hover:bg-(--as-bg)">
          {t.offers}
        </StoreLink>
      </div>
    </nav>
  );
}

function SearchBox({ onClose }: { onClose: () => void }) {
  const { mode } = useShabe();
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col" role="dialog" aria-modal="true" aria-label={t.search}>
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label={t.closeSearch} />
      <div className="ss-search-panel relative bg-(--as-bg) text-(--as-text) shadow-2xl">
        <form role="search" action="/products" className="ss-wrap flex items-center gap-2 py-4" onSubmit={(e) => mode !== "live" && e.preventDefault()}>
          <label className="flex h-12 flex-1 items-center gap-2 rounded-full border-2 bg-(--ss-cream) px-4">
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
  const { data } = useShabe();
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div className="ss-drawer fixed inset-0 z-[60] flex @5xl:hidden" data-open={open ? "" : undefined} role="dialog" aria-modal="true" aria-label={t.menu} aria-hidden={!open} inert={!open}>
      <button type="button" className="ss-drawer-shade absolute inset-0 bg-black/45" onClick={onClose} aria-label={t.closeMenu} />
      <div className="ss-drawer-panel relative flex h-full w-[min(22rem,88%)] flex-col overflow-y-auto overscroll-contain bg-(--as-bg) p-5 text-(--as-text) shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <Logo small />
          <IconButton label={t.closeMenu} onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <StoreLink href="/products" className="ss-display as-xl border-b py-3">
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
        <div className="mt-6 flex flex-col gap-3">
          <Hotline />
          <OrderButton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * The dark strip (announcement + countdown), then the logo at the start or in the middle, the
 * hotline and «اطلب دلوقتي», search, account and cart; the categories row under it.
 */
export function Header() {
  const { settings, mode } = useShabe();
  const [open, setOpen] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const ref = React.useRef<HTMLElement>(null);
  const center = settings.header.layout === "center";
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
    <div className="flex items-center gap-0.5">
      {settings.header.search ? (
        <IconButton label={t.search} onClick={() => setSearching(true)}>
          <Search className="size-5" />
        </IconButton>
      ) : null}
      <IconButton href="/account" label={t.account}>
        <UserRound className="size-5" />
      </IconButton>
      <CartLink />
    </div>
  );

  return (
    <header ref={ref} className={cn("ss-header", !settings.header.sticky && "!static")} data-scrolled={scrolled ? "" : undefined}>
      <Strip />
      <div className="ss-mainrow">
        <div className={cn("ss-wrap grid h-full items-center gap-3", center ? "grid-cols-[1fr_auto_1fr]" : "grid-cols-[auto_1fr_auto]")}>
          <div className="flex items-center gap-2">
            <span className="@5xl:hidden">
              <IconButton label={t.openMenu} onClick={() => setOpen(true)}>
                <Menu className="size-5" />
              </IconButton>
            </span>
            {center ? (
              <span className="hidden @5xl:block">
                <Hotline />
              </span>
            ) : (
              <Logo />
            )}
          </div>
          <div className={cn("flex items-center", center ? "justify-center" : "justify-end gap-4 @5xl:justify-center")}>
            {center ? <Logo /> : <span className="hidden @5xl:block"><Hotline /></span>}
          </div>
          <div className="flex items-center justify-end gap-2">
            {icons}
            {/* Phones: the button sits in the menu (its own display rule would beat a hidden class here). */}
            <span className="hidden @3xl:block">
              <OrderButton />
            </span>
          </div>
        </div>
      </div>
      {settings.header.categories_menu ? <CategoriesRow /> : null}
      {searching ? <SearchBox onClose={closeSearch} /> : null}
      <Drawer open={open} onClose={closeMenu} />
    </header>
  );
}

/** About, the menu, help and contact; light or dark; the payment note; then the copyright. */
export function Footer() {
  const { settings, data, storeName } = useShabe();
  const f = settings.footer;
  const year = new Date().getFullYear();
  const socials = SOCIALS.filter((n) => f.social[n]);
  const top = data.categories.filter((c) => c.parent_id === null).slice(0, 6);
  return (
    <footer className={cn("mt-auto", f.dark ? "ss-dark" : "ss-cream border-t")}>
      <div className="ss-wrap grid gap-10 py-12 @3xl:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
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
          {f.payments ? (
            <p className="as-xs flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 font-bold">
              <Banknote className="size-4 text-(--as-primary)" aria-hidden />
              {t.footer.payments}
            </p>
          ) : null}
        </div>
        <div>
          <h3 className="ss-display as-lg mb-3">{t.footer.shop}</h3>
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
          <h3 className="ss-display as-lg mb-3">{t.footer.help}</h3>
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
        {f.phone || f.whatsapp || f.email || f.address ? (
          <div>
            <h3 className="ss-display as-lg mb-3">{t.footer.contact}</h3>
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
          </div>
        ) : null}
      </div>
      <div className={cn("border-t", f.dark ? "border-white/10" : "")}>
        <div className="ss-wrap as-xs flex flex-col justify-between gap-2 py-5 as-muted @3xl:flex-row">
          <span>{t.footer.rights(storeName, year)}</span>
          <span>{t.footer.madeWith}</span>
        </div>
      </div>
    </footer>
  );
}

/** WhatsApp and call buttons at the corner. */
export function Floaters() {
  const { settings } = useShabe();
  const f = settings.footer;
  const g = settings.general;
  const callNumber = g.call_phone || f.phone;
  const wa = g.whatsapp_button && f.whatsapp ? whatsappLink(f.whatsapp) : null;
  const call = g.floating_call && callNumber ? telLink(callNumber) : null;
  if (!wa && !call) return null;
  return (
    <div className="fixed bottom-5 end-5 z-[35] flex flex-col gap-3 [[data-mode=builder]_&]:absolute">
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex size-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-xl" aria-label={t.whatsapp}>
          <WhatsAppIcon className="size-7" />
        </a>
      ) : null}
      {call ? (
        <a href={call} className="flex size-14 items-center justify-center rounded-full bg-(--as-primary) text-(--as-on-primary) shadow-xl" aria-label={t.call}>
          <Phone className="size-5" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
