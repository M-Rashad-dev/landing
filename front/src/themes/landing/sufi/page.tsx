"use client";

import { MessageCircle, Moon, Phone, Sun } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { SocialIcon, WhatsAppIcon } from "@/themes/store/asas/icons";
import { SOCIALS, type MediaUrls } from "@/themes/shared/design";
import { imageSrc, scrollToOrder, useImage, usePage, useProductImages } from "@/themes/landing/bidaya/context";
import { usePrice } from "@/themes/landing/bidaya/sections";
import type { LandingData } from "@/themes/landing/bidaya/types";
import { OrderForm } from "./order-form";
import { SufiLandingRoot, useSufiScheme } from "./root";
import { Bundles, Countdown, Details, Faq, Features, Gallery, Hero, Marquee, Promises, Specs, Stats, Testimonials, Video } from "./sections";
import type { SufiLandingContent, SufiLandingSection, SufiLandingSettings } from "./types";

const t = ar.sufiLanding;
const b = ar.bidaya;

export type Selection = string | "header" | "footer" | null;

const waLink = (number: string) => `https://wa.me/${number.replace(/\D/g, "").replace(/^0/, "20")}`;

function useSettings(): SufiLandingSettings {
  return usePage().settings as SufiLandingSettings;
}

/** The logo of the scheme drawn now (the dark one falls back to the normal one), or the store name. */
function Logo({ className }: { className: string }) {
  const { data } = usePage();
  const settings = useSettings();
  const { scheme } = useSufiScheme();
  const light = useImage(settings.logo_media_id);
  const dark = useImage(settings.logo_dark_media_id);
  const src = imageSrc(scheme === "dark" ? (dark ?? light) : light, "medium");
  if (!src) return <span className="sl-display as-2xl">{data.store_name}</span>;
  // eslint-disable-next-line @next/next/no-img-element -- store logo from the media server
  return <img src={src} alt={data.store_name} className={className} />;
}

function SchemeSwitch() {
  const { scheme, toggle } = useSufiScheme();
  const settings = useSettings();
  const { mode } = usePage();
  // The Builder shows the switch (inert) so the merchant sees where it sits.
  if (!settings.appearance.toggle || (!toggle && mode === "live")) return null;
  const label = scheme === "dark" ? t.toLight : t.toDark;
  return (
    <button type="button" onClick={toggle ?? undefined} aria-label={label} title={label} className="flex size-10 items-center justify-center rounded-full border transition hover:border-(--as-primary) hover:text-(--as-primary)">
      {scheme === "dark" ? <Sun className="size-4.5" aria-hidden /> : <Moon className="size-4.5" aria-hidden />}
    </button>
  );
}

function Header() {
  const { mode } = usePage();
  const settings = useSettings();
  return (
    <header>
      {settings.header.announcement ? <p className="sl-announce as-xs px-4 py-2.5 text-center font-semibold tracking-wide">{settings.header.announcement}</p> : null}
      {settings.header.show ? (
        <div className="sl-header">
          <div className="sl-wrap flex h-16 items-center justify-between gap-3 @3xl:h-20">
            <Logo className="h-10 w-auto max-w-[10rem] object-contain @3xl:h-12" />
            <div className="flex items-center gap-2.5">
              <SchemeSwitch />
              {settings.header.button_label ? (
                <button type="button" onClick={() => scrollToOrder(mode)} className="sl-btn sl-btn-ink as-sm h-10 px-5 @3xl:h-11">
                  {settings.header.button_label}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Footer() {
  const { data } = usePage();
  const settings = useSettings();
  const f = settings.footer;
  const socials = SOCIALS.filter((s) => f.social[s]);
  return (
    <footer className="sl-band pb-28 pt-14 @3xl:pb-12">
      <div className="sl-wrap flex flex-col items-center gap-6 text-center">
        <Logo className="h-12 w-auto max-w-[11rem] object-contain" />
        {f.text ? <p className="as-sm as-muted max-w-lg">{f.text}</p> : null}
        {socials.length ? (
          <ul className="flex gap-2">
            {socials.map((network) => (
              <li key={network}>
                <a href={f.social[network]!} target="_blank" rel="noopener noreferrer" aria-label={network} className="flex size-10 items-center justify-center rounded-full border transition hover:border-(--as-primary) hover:text-(--as-primary)">
                  <SocialIcon network={network} className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {f.phone || f.whatsapp ? (
          <p className="as-sm flex flex-wrap justify-center gap-5 font-semibold">
            {f.phone ? (
              <a href={`tel:${f.phone}`} className="flex items-center gap-1.5" dir="ltr">
                <Phone className="size-3.5 text-(--as-primary)" aria-hidden />
                {f.phone}
              </a>
            ) : null}
            {f.whatsapp ? (
              <a href={waLink(f.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                <MessageCircle className="size-3.5 text-(--as-primary)" aria-hidden />
                {b.footer.whatsapp}
              </a>
            ) : null}
          </p>
        ) : null}
        <span className="as-xs as-muted w-full border-t pt-6">{b.footer.rights(data.store_name)}</span>
      </div>
    </footer>
  );
}

/** The product, its price and «اطلب» stay at the bottom until the order form is on screen. */
function StickyOrder({ label }: { label: string }) {
  const { mode, data } = usePage();
  const price = usePrice();
  const image = imageSrc(useProductImages()[0] ?? null, "thumb");
  const [formVisible, setFormVisible] = React.useState(false);
  React.useEffect(() => {
    const form = document.getElementById("order");
    if (!form || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(form);
    return () => observer.disconnect();
  }, []);
  return (
    <div className={cn("sticky bottom-0 z-20 border-t bg-(--as-bg)/95 backdrop-blur transition-transform duration-300", formVisible && "pointer-events-none translate-y-full opacity-0")}>
      <div className="sl-wrap flex h-18 items-center justify-between gap-3 @3xl:h-20">
        <div className="flex min-w-0 items-center gap-3">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- store media, already resized
            <img src={image} alt="" className="size-11 shrink-0 rounded-full object-cover @3xl:size-12" />
          ) : null}
          <span className="hidden min-w-0 flex-col @3xl:flex">
            <b className="as-sm truncate">{data.product?.name}</b>
          </span>
          {price ? (
            <span className="flex items-baseline gap-2">
              <b className="as-lg font-extrabold whitespace-nowrap">{formatMoney(price.now)}</b>
              {price.was ? <s className="as-xs as-muted">{formatMoney(price.was)}</s> : null}
            </span>
          ) : null}
        </div>
        <button type="button" onClick={() => scrollToOrder(mode)} className="sl-btn sl-btn-gold as-base h-12 shrink-0">
          {label}
        </button>
      </div>
    </div>
  );
}

function SectionView({ section, next }: { section: SufiLandingSection; next: string | null }) {
  switch (section.type) {
    case "hero":
      return <Hero props={section.props} nextId={next} />;
    case "marquee":
      return <Marquee props={section.props} />;
    case "features":
      return <Features props={section.props} />;
    case "details":
      return <Details props={section.props} />;
    case "specs":
      return <Specs props={section.props} />;
    case "gallery":
      return <Gallery props={section.props} />;
    case "video":
      return <Video props={section.props} />;
    case "bundles":
      return <Bundles props={section.props} />;
    case "stats":
      return <Stats props={section.props} />;
    case "testimonials":
      return <Testimonials props={section.props} />;
    case "countdown":
      return <Countdown props={section.props} />;
    case "order_form":
      return <OrderForm props={section.props} />;
    case "promises":
      return <Promises props={section.props} />;
    case "faq":
      return <Faq props={section.props} />;
  }
}

/**
 * The whole «صوفي» page: announcement + header, the visible sections in order, footer, the
 * sticky order bar and WhatsApp. The Builder draws it too (parts selectable, tools over them).
 */
export function SufiLandingPage({
  content,
  data,
  mode = "live",
  selected = null,
  onSelect,
  tools,
  media = {},
}: {
  content: SufiLandingContent;
  data: LandingData;
  mode?: "live" | "builder" | "preview";
  selected?: Selection;
  onSelect?: (id: Selection) => void;
  tools?: (id: Selection) => React.ReactNode;
  media?: Record<string, MediaUrls>;
}) {
  const { settings } = content;
  const builder = mode === "builder";
  const select = (id: Selection) => (event: React.MouseEvent) => {
    if (!builder || !onSelect) return;
    if ((event.target as HTMLElement).closest("[data-builder-tools]")) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(id);
  };
  const frame = (id: Selection) => (builder ? cn("as-selectable", selected === id && "as-selected") : undefined);
  const toolsOf = (id: Selection) => (builder && tools && selected === id ? <div data-builder-tools className="absolute end-3 top-3 z-20">{tools(id)}</div> : null);
  const visible = content.sections.filter((s) => s.visible);
  const hero = visible.find((s) => s.type === "hero");
  const ctaLabel = hero?.type === "hero" ? hero.props.button_label : b.orderNow;
  const whatsapp = settings.footer.whatsapp;

  return (
    <SufiLandingRoot settings={settings} data={data} mode={mode} media={media} className="min-h-full">
      <div className={frame("header")} onClickCapture={builder ? select("header") : undefined}>
        <Header />
        {toolsOf("header")}
      </div>
      <main>
        {visible.map((s, i) => (
          <div key={s.id} id={`section-${s.id}`} className={cn("relative", frame(s.id))} onClickCapture={builder ? select(s.id) : undefined}>
            <SectionView section={s} next={visible[i + 1]?.id ?? null} />
            {toolsOf(s.id)}
          </div>
        ))}
      </main>
      <div className={frame("footer")} onClickCapture={builder ? select("footer") : undefined}>
        <Footer />
        {toolsOf("footer")}
      </div>
      {settings.general.whatsapp_button && whatsapp && !builder ? (
        <a href={waLink(whatsapp)} target="_blank" rel="noopener noreferrer" aria-label={b.footer.whatsapp} className="fixed bottom-24 end-4 z-30 flex size-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg @3xl:bottom-28">
          <WhatsAppIcon className="size-7" />
        </a>
      ) : null}
      {settings.general.sticky_order_button ? <StickyOrder label={ctaLabel} /> : null}
    </SufiLandingRoot>
  );
}
