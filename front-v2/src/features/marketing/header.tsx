"use client";

import { Menu, X } from "lucide-react";
import * as React from "react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { SECTIONS } from "./nav";

const t = ar.marketing.nav;

/** Sticky header: clear over the hero, frosted once the page moves; a sheet menu on phones. */
export function MarketingHeader({ loginUrl, registerUrl }: { loginUrl: string; registerUrl: string }) {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className={cn("sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-500", scrolled || open ? "bg-[color-mix(in_srgb,var(--mk-paper)_82%,transparent)] shadow-[0_1px_0_var(--border)] backdrop-blur-xl" : "bg-transparent")}>
      <div className="mk-wrap flex h-16 items-center gap-10 md:h-20">
        <a href="#top" aria-label={ar.marketing.meta.title}>
          <Logo />
        </a>
        <nav aria-label={t.menu} className="hidden items-center gap-7 text-[15px] font-medium text-ink-2 lg:flex">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="mk-link">
              {s.label}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <a href={loginUrl} className="hidden h-10 items-center px-3 text-[15px] font-semibold sm:flex">
            {t.login}
          </a>
          <a href={registerUrl} className="mk-btn mk-btn-ink h-10 px-4 text-sm md:h-11">
            {t.start}
          </a>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mk-menu" aria-label={open ? t.close : t.menu} className="flex size-10 items-center justify-center rounded-xl lg:hidden">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <div id="mk-menu" hidden={!open} className="mk-wrap border-t border-border pb-6 lg:hidden">
        <nav className="flex flex-col py-2 text-lg font-semibold">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={() => setOpen(false)} className="border-b border-border py-3.5">
              {s.label}
            </a>
          ))}
        </nav>
        <a href={loginUrl} className="mk-btn mk-btn-line mt-4 h-12 w-full">
          {t.login}
        </a>
      </div>
    </header>
  );
}
