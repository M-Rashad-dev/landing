"use client";

import { Mail, MapPin, Menu, MessageCircle, Phone, Search, ShoppingBag, UserRound, X } from "lucide-react";
import * as React from "react";
import { cartCount, useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { StoreLink, useHydrated, useTheme } from "./context";
import { SocialIcon } from "./icons";
import { pick, SOCIALS } from "./types";

const t = ar.storefront;

function Logo() {
  const { settings, data, media, storeName } = useTheme();
  const logo = settings.logo_media_id ? pick(media[String(settings.logo_media_id)] ?? data.media[String(settings.logo_media_id)], "medium") : null;
  return (
    <StoreLink href="/" className="flex min-w-0 items-center gap-2">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- store logo from the media server
        <img src={logo} alt={storeName} className="h-9 w-auto max-w-[9rem] object-contain @3xl:h-11" />
      ) : (
        <span className="as-lg truncate font-extrabold">{storeName}</span>
      )}
    </StoreLink>
  );
}

/** The cart icon with how many pieces are in it (live store only). */
function CartButton() {
  const { mode } = useTheme();
  const count = cartCount(useCart());
  // A short bounce each time something is added (not when the saved cart is first read).
  const hydrated = useHydrated();
  const [seen, setSeen] = React.useState<number | null>(null);
  const [bump, setBump] = React.useState(0);
  if (hydrated && seen !== count) {
    if (seen !== null && count > seen) setBump(bump + 1);
    setSeen(count);
  }

  return (
    <StoreLink href="/cart" className="relative flex size-10 items-center justify-center rounded-full hover:bg-(--as-soft)" aria-label={count && mode === "live" ? `${t.cart} (${count})` : t.cart}>
      <ShoppingBag key={bump} className={cn("size-5", bump > 0 && "as-bump")} />
      {count && mode === "live" ? (
        <span className="as-xs absolute -end-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-(--as-primary) px-1 font-bold text-(--as-on-primary)" aria-hidden>
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </StoreLink>
  );
}

/** Logo, the categories (the menu of «أساس»), search and cart; the announcement bar above. */
export function Header() {
  const { settings, data } = useTheme();
  const [open, setOpen] = React.useState(false);
  const top = data.categories.filter((c) => c.parent_id === null);
  const children = (id: number) => data.categories.filter((c) => c.parent_id === id);

  return (
    <header className={cn("z-30 bg-(--as-bg)", settings.header.sticky && "sticky top-0")}>
      {settings.header.announcement ? <p className="as-xs bg-(--as-secondary) px-4 py-2 text-center font-semibold text-(--as-on-secondary)">{settings.header.announcement}</p> : null}
      <div className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 @3xl:px-6">
          <button type="button" onClick={() => setOpen(true)} className="-ms-1 flex size-9 items-center justify-center rounded-lg @5xl:hidden" aria-label={t.menu}>
            <Menu className="size-5" />
          </button>
          <Logo />
          <nav className="ms-4 hidden flex-1 items-center gap-1 @5xl:flex" aria-label={t.menu}>
            <StoreLink href="/products" className="as-sm rounded-lg px-3 py-2 font-semibold hover:bg-(--as-soft)">
              {t.allProducts}
            </StoreLink>
            {top.slice(0, 7).map((c) => (
              <div key={c.id} className="group relative">
                <StoreLink href={`/categories/${encodeURIComponent(c.slug)}`} className="as-sm block rounded-lg px-3 py-2 font-semibold hover:bg-(--as-soft)">
                  {c.name}
                </StoreLink>
                {children(c.id).length ? (
                  <div className="invisible absolute start-0 top-full z-40 min-w-44 rounded-xl border bg-(--as-bg) p-1.5 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                    {children(c.id).map((sub) => (
                      <StoreLink key={sub.id} href={`/categories/${encodeURIComponent(sub.slug)}`} className="as-sm block rounded-lg px-3 py-2 hover:bg-(--as-soft)">
                        {sub.name}
                      </StoreLink>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            {settings.header.search ? (
              <form role="search" action="/products" className="hidden @3xl:block" onSubmit={(e) => e.currentTarget.closest("[data-mode]:not([data-mode=live])") && e.preventDefault()}>
                <label className="flex h-10 items-center gap-2 rounded-full border bg-(--as-card) px-3">
                  <Search className="size-4 as-muted" aria-hidden />
                  <input name="q" type="search" placeholder={t.search} aria-label={t.search} className="as-sm w-44 bg-transparent outline-none placeholder:text-(--as-muted)" />
                </label>
              </form>
            ) : null}
            {settings.header.search ? (
              <StoreLink href="/products" className="flex size-10 items-center justify-center rounded-full @3xl:hidden" aria-label={t.search}>
                <Search className="size-5" />
              </StoreLink>
            ) : null}
            <StoreLink href="/account" className="flex size-10 items-center justify-center rounded-full hover:bg-(--as-soft)" aria-label={t.account.title}>
              <UserRound className="size-5" />
            </StoreLink>
            <CartButton />
          </div>
        </div>
      </div>

      {open ? (
        <div className="absolute inset-x-0 top-0 z-50 min-h-[60vh] border-b bg-(--as-bg) p-4 shadow-xl @5xl:hidden">
          <div className="mb-3 flex items-center justify-between">
            <Logo />
            <button type="button" onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded-lg" aria-label={t.close}>
              <X className="size-5" />
            </button>
          </div>
          <nav className="flex flex-col" aria-label={t.menu}>
            <StoreLink href="/products" className="as-base border-b py-3 font-semibold">
              {t.allProducts}
            </StoreLink>
            {top.map((c) => (
              <div key={c.id} className="border-b py-2">
                <StoreLink href={`/categories/${encodeURIComponent(c.slug)}`} className="as-base block py-1 font-semibold">
                  {c.name}
                </StoreLink>
                {children(c.id).map((sub) => (
                  <StoreLink key={sub.id} href={`/categories/${encodeURIComponent(sub.slug)}`} className="as-sm block py-1 ps-4 as-muted">
                    {sub.name}
                  </StoreLink>
                ))}
              </div>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

/** wa.me wants the number in international form: Egyptian 01… becomes 201…. */
function whatsappLink(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, "").replace(/^0/, "20")}`;
}

/** About, pages, contact and social, then the copyright and «صنع بواسطة مكسب» (always shown for now). */
export function Footer() {
  const { settings, data, storeName } = useTheme();
  const f = settings.footer;
  const socials = SOCIALS.filter((s) => f.social[s]);
  const contact = [
    f.phone ? { icon: Phone, label: f.phone, href: `tel:${f.phone.replace(/\s+/g, "")}`, ltr: true } : null,
    f.whatsapp ? { icon: MessageCircle, label: f.whatsapp, href: whatsappLink(f.whatsapp), ltr: true } : null,
    f.email ? { icon: Mail, label: f.email, href: `mailto:${f.email}`, ltr: true } : null,
    f.address ? { icon: MapPin, label: f.address, href: null, ltr: false } : null,
  ].filter(Boolean) as Array<{ icon: typeof Phone; label: string; href: string | null; ltr: boolean }>;
  const pages = f.show_pages ? data.pages : [];
  // The floating WhatsApp button sits at the bottom end: keep «صنع بواسطة مكسب» clear of it.
  const floating = settings.general.whatsapp_button && Boolean(f.whatsapp);

  return (
    <footer className="mt-10 border-t bg-(--as-card)">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 @3xl:grid-cols-4 @3xl:px-6">
        <div className="@3xl:col-span-2">
          <p className="as-lg font-extrabold">{storeName}</p>
          {f.about ? <p className="as-sm as-muted mt-2 max-w-md whitespace-pre-line">{f.about}</p> : null}
          {socials.length ? (
            <div className="mt-4 flex flex-wrap gap-2" aria-label={t.footer.follow}>
              {socials.map((s) => (
                <StoreLink key={s} href={f.social[s]} className="flex size-9 items-center justify-center rounded-full border hover:bg-(--as-soft)" aria-label={t.social[s]}>
                  <SocialIcon network={s} className="size-4" />
                </StoreLink>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <p className="as-sm mb-3 font-bold">{t.footer.pages}</p>
          <ul className="flex flex-col gap-2">
            <li>
              <StoreLink href="/track" className="as-sm as-muted hover:underline">
                {t.footer.track}
              </StoreLink>
            </li>
            {pages.map((p) => (
              <li key={p.slug}>
                <StoreLink href={`/pages/${encodeURIComponent(p.slug)}`} className="as-sm as-muted hover:underline">
                  {p.title}
                </StoreLink>
              </li>
            ))}
          </ul>
        </div>
        {contact.length ? (
          <div>
            <p className="as-sm mb-3 font-bold">{t.footer.contact}</p>
            <ul className="flex flex-col gap-2">
              {contact.map((c) => (
                <li key={c.label} className="as-sm as-muted flex items-center gap-2">
                  <c.icon className="size-4 shrink-0" aria-hidden />
                  {c.href ? (
                    <StoreLink href={c.href} className="hover:underline" dir={c.ltr ? "ltr" : undefined}>
                      {c.label}
                    </StoreLink>
                  ) : (
                    <span>{c.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="border-t">
        <div className={cn("mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 @3xl:flex-row @3xl:px-6", floating && "@3xl:pe-24")}>
          <p className="as-xs as-muted">{t.footer.rights(storeName, new Date().getFullYear())}</p>
          <span className="as-xs inline-flex items-center gap-1.5 rounded-full border bg-(--as-bg) px-3 py-1.5 font-semibold shadow-sm">
            {t.madeBy}
            <span className="font-extrabold as-primary">{t.platform}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

export function WhatsappButton() {
  const { settings } = useTheme();
  const number = settings.footer.whatsapp;
  if (!settings.general.whatsapp_button || !number) return null;
  return (
    // A zero-height sticky line: the button floats over the page without adding space under the footer.
    <div className="pointer-events-none sticky bottom-0 z-40 h-0">
      <StoreLink
        href={whatsappLink(number)}
        className="pointer-events-auto absolute end-4 bottom-4 flex size-13 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg"
        aria-label={t.whatsapp}
      >
        <MessageCircle className="size-6" />
      </StoreLink>
    </div>
  );
}
