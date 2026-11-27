"use client";

import { MessageCircle, Phone } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { SocialIcon, WhatsAppIcon } from "@/themes/store/asas/icons";
import { LandingAiSection } from "@/themes/landing/shared/ai-section";
import { SOCIALS, type MediaUrls } from "@/themes/shared/design";
import { imageSrc, scrollToOrder, useImage, usePage, useProductImages } from "@/themes/landing/bidaya/context";
import { usePrice } from "@/themes/landing/bidaya/sections";
import type { LandingData } from "@/themes/landing/bidaya/types";
import { OrderForm } from "./order-form";
import { RawaqLandingRoot } from "./root";
import { BeforeAfter, Benefits, Bundles, Countdown, Faq, Gallery, Hero, HowTo, Ingredients, Promises, Stats, Suits, Testimonials, Trust, Video } from "./sections";
import type { RawaqLandingContent, RawaqLandingSection, RawaqLandingSettings } from "./types";

const b = ar.bidaya;

export type Selection = string | "header" | "footer" | null;

const waLink = (number: string) => `https://wa.me/${number.replace(/\D/g, "").replace(/^0/, "20")}`;

function useSettings(): RawaqLandingSettings {
  return usePage().settings as RawaqLandingSettings;
}

function Logo({ className }: { className: string }) {
  const { data } = usePage();
  const settings = useSettings();
  const src = imageSrc(useImage(settings.logo_media_id), "medium");
  if (!src) return <span className="rl-display as-2xl text-(--as-primary)">{data.store_name}</span>;
  // eslint-disable-next-line @next/next/no-img-element -- store logo from the media server
  return <img src={src} alt={data.store_name} className={className} />;
}

function Header() {
  const { mode } = usePage();
  const settings = useSettings();
  return (
    <header>
      {settings.header.announcement ? <p className="rl-dark as-sm px-4 py-2.5 text-center font-bold">{settings.header.announcement}</p> : null}
      {settings.header.show ? (
        <div className="border-b bg-(--as-bg)">
          <div className="rl-wrap flex h-16 items-center justify-between gap-3 @3xl:h-20">
            <Logo className="h-10 w-auto max-w-[10rem] object-contain @3xl:h-12" />
            {settings.header.button_label ? (
              <button type="button" onClick={() => scrollToOrder(mode)} className="rl-btn rl-btn-main as-sm h-11">
                {settings.header.button_label}
              </button>
            ) : null}
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
    <footer className="rl-dark pb-28 pt-12 @3xl:pb-10">
      <div className="rl-wrap flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-6 border-b pb-7 @3xl:flex-row @3xl:items-center">
          <div className="flex flex-col gap-2">
            <Logo className="h-11 w-auto max-w-[10rem] object-contain" />
            {f.text ? <p className="as-sm as-muted max-w-md">{f.text}</p> : null}
          </div>
          {socials.length ? (
            <ul className="flex gap-2">
              {socials.map((network) => (
                <li key={network}>
                  <a href={f.social[network]!} target="_blank" rel="noopener noreferrer" aria-label={network} className="flex size-11 items-center justify-center rounded-full border hover:bg-(--as-card)">
                    <SocialIcon network={network} className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="as-xs flex flex-col justify-between gap-2 as-muted @3xl:flex-row">
          <span>{b.footer.rights(data.store_name)}</span>
          <span className="flex flex-wrap gap-4 font-semibold">
            {f.phone ? (
              <a href={`tel:${f.phone}`} className="flex items-center gap-1.5" dir="ltr">
                <Phone className="size-3.5" aria-hidden />
                {f.phone}
              </a>
            ) : null}
            {f.whatsapp ? (
              <a href={waLink(f.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                <MessageCircle className="size-3.5" aria-hidden />
                {b.footer.whatsapp}
              </a>
            ) : null}
          </span>
        </div>
      </div>
    </footer>
  );
}

/** The product, its price and «اطلبي» stay at the bottom until the order form is on screen. */
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
    <div className={cn("sticky bottom-0 z-20 border-t bg-(--as-bg)/95 shadow-[0_-12px_30px_-18px_rgb(60_20_35/0.35)] backdrop-blur transition-transform", formVisible && "pointer-events-none translate-y-full opacity-0")}>
      <div className="rl-wrap flex h-19 items-center justify-between gap-3 @3xl:h-22">
        <div className="flex min-w-0 items-center gap-3">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- store media, already resized
            <img src={image} alt="" className="size-12 shrink-0 rounded-full bg-(--rl-blush) object-cover @3xl:size-14" />
          ) : null}
          <span className="hidden min-w-0 flex-col @3xl:flex">
            <b className="as-base truncate">{data.product?.name}</b>
          </span>
          {price ? (
            <span className="flex items-baseline gap-2">
              <b className="rl-display as-xl whitespace-nowrap text-(--as-primary)">{formatMoney(price.now)}</b>
              {price.was ? <s className="as-xs as-muted">{formatMoney(price.was)}</s> : null}
            </span>
          ) : null}
        </div>
        <button type="button" onClick={() => scrollToOrder(mode)} className="rl-btn rl-btn-main as-base h-12 shrink-0">
          {label}
        </button>
      </div>
    </div>
  );
}

function SectionView({ section, next }: { section: RawaqLandingSection; next: string | null }) {
  switch (section.type) {
    case "hero":
      return <Hero props={section.props} nextId={next} />;
    case "trust":
      return <Trust props={section.props} />;
    case "benefits":
      return <Benefits props={section.props} />;
    case "before_after":
      return <BeforeAfter props={section.props} />;
    case "ingredients":
      return <Ingredients props={section.props} />;
    case "how_to":
      return <HowTo props={section.props} />;
    case "suits":
      return <Suits props={section.props} />;
    case "bundles":
      return <Bundles props={section.props} />;
    case "stats":
      return <Stats props={section.props} />;
    case "gallery":
      return <Gallery props={section.props} />;
    case "video":
      return <Video props={section.props} />;
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
    case "ai":
      return <LandingAiSection section={section} themeKey="rawaq_landing" />;
  }
}

/**
 * The whole «رواق» page: announcement + header, the visible sections in order, footer, the sticky
 * order bar and WhatsApp. The Builder draws it too (parts selectable, tools over them).
 */
export function RawaqLandingPage({
  content,
  data,
  mode = "live",
  selected = null,
  onSelect,
  tools,
  media = {},
}: {
  content: RawaqLandingContent;
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
    <RawaqLandingRoot settings={settings} data={data} mode={mode} media={media} className="min-h-full">
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
    </RawaqLandingRoot>
  );
}
