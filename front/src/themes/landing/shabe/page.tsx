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
import { ShabeRoot } from "./root";
import { Bundles, Compare, Faq, Gallery, Guarantee, Hero, Marquee, Menu, pad, Steps, Testimonials, timeLeft, Urgency, useNow, Video, Why } from "./sections";
import type { ShabeContent, ShabeSection, ShabeSettings } from "./types";

const t = ar.shabe;
const b = ar.bidaya;

export type Selection = string | "header" | "footer" | null;

const waLink = (number: string) => `https://wa.me/${number.replace(/\D/g, "").replace(/^0/, "20")}`;

function useSettings(): ShabeSettings {
  return usePage().settings as ShabeSettings;
}

function Announcement() {
  const { mode } = usePage();
  const { header } = useSettings();
  const now = useNow(mode !== "builder");
  const left = header.countdown_ends_at ? timeLeft(header.countdown_ends_at, now) : null;
  const running = left && !left.ended;
  if (!header.announcement && !running) return null;
  return (
    <p className="sh-dark as-sm flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2.5 text-center font-bold">
      {header.announcement ? <span>{header.announcement}</span> : null}
      {running ? (
        <span className="flex items-center gap-1.5" dir="ltr" role="timer" aria-label={t.endsIn}>
          {left.parts.map((part, i) => (
            <React.Fragment key={part.label}>
              {i ? <span aria-hidden>:</span> : null}
              <span className="rounded-md bg-(--as-primary) px-2 tabular-nums text-(--as-on-primary)">{pad(part.value)}</span>
            </React.Fragment>
          ))}
        </span>
      ) : null}
    </p>
  );
}

function Header() {
  const { data, mode } = usePage();
  const settings = useSettings();
  const logo = imageSrc(useImage(settings.logo_media_id), "medium");
  return (
    <header>
      <Announcement />
      {settings.header.show ? (
        <div className="border-b bg-(--as-bg)">
          <div className="sh-wrap flex h-16 items-center justify-between gap-3 @3xl:h-20">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- store logo from the media server
              <img src={logo} alt={data.store_name} className="h-10 w-auto max-w-[10rem] object-contain @3xl:h-12" />
            ) : (
              <span className="sh-display as-2xl as-primary">{data.store_name}</span>
            )}
            <div className="flex items-center gap-3">
              {settings.header.phone ? (
                <a href={`tel:${settings.header.phone}`} className="as-sm hidden items-center gap-1.5 font-bold as-muted @3xl:flex" dir="ltr">
                  <Phone className="size-4 as-primary" aria-hidden />
                  {settings.header.phone}
                </a>
              ) : null}
              {settings.header.button_label ? (
                <button type="button" onClick={() => scrollToOrder(mode)} className="as-btn sh-btn-fire as-sm h-11 px-5">
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
  const logo = imageSrc(useImage(settings.logo_media_id), "medium");
  const socials = SOCIALS.filter((s) => f.social[s]);
  return (
    <footer className="sh-dark pb-28 pt-12 @3xl:pb-10">
      <div className="sh-wrap flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-6 border-b pb-7 @3xl:flex-row @3xl:items-center">
          <div className="flex flex-col gap-2">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- store logo from the media server
              <img src={logo} alt={data.store_name} className="h-11 w-auto max-w-[10rem] object-contain" />
            ) : (
              <span className="sh-display as-2xl">{data.store_name}</span>
            )}
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
                <Phone className="size-3.5 as-primary" aria-hidden />
                {f.phone}
              </a>
            ) : null}
            {f.whatsapp ? (
              <a href={waLink(f.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                <MessageCircle className="size-3.5 as-primary" aria-hidden />
                {b.footer.whatsapp}
              </a>
            ) : null}
          </span>
        </div>
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
    <div className={cn("sticky bottom-0 z-20 border-t bg-(--as-bg)/95 shadow-[0_-12px_30px_-18px_rgb(0_0_0/0.35)] backdrop-blur transition-transform", formVisible && "pointer-events-none translate-y-full opacity-0")}>
      <div className="sh-wrap flex h-19 items-center justify-between gap-3 @3xl:h-22">
        <div className="flex min-w-0 items-center gap-3">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- store media, already resized
            <img src={image} alt="" className="size-12 shrink-0 rounded-xl object-cover @3xl:size-14" />
          ) : null}
          <span className="hidden min-w-0 flex-col @3xl:flex">
            <b className="as-base truncate">{data.product?.name}</b>
          </span>
          {price ? (
            <span className="flex items-baseline gap-2">
              <b className="as-xl font-black whitespace-nowrap">{formatMoney(price.now)}</b>
              {price.was ? <s className="as-xs as-muted">{formatMoney(price.was)}</s> : null}
            </span>
          ) : null}
        </div>
        <button type="button" onClick={() => scrollToOrder(mode)} className="as-btn sh-btn-fire as-base h-12 shrink-0 px-6">
          {label}
        </button>
      </div>
    </div>
  );
}

function SectionView({ section, next }: { section: ShabeSection; next: string | null }) {
  switch (section.type) {
    case "hero":
      return <Hero props={section.props} nextId={next} />;
    case "marquee":
      return <Marquee props={section.props} />;
    case "menu":
      return <Menu props={section.props} />;
    case "why":
      return <Why props={section.props} />;
    case "steps":
      return <Steps props={section.props} />;
    case "bundles":
      return <Bundles props={section.props} />;
    case "gallery":
      return <Gallery props={section.props} />;
    case "video":
      return <Video props={section.props} />;
    case "compare":
      return <Compare props={section.props} />;
    case "testimonials":
      return <Testimonials props={section.props} />;
    case "urgency":
      return <Urgency props={section.props} />;
    case "order_form":
      return <OrderForm props={section.props} />;
    case "guarantee":
      return <Guarantee props={section.props} />;
    case "faq":
      return <Faq props={section.props} />;
    case "ai":
      return <LandingAiSection section={section} themeKey="shabe_landing" />;
  }
}

/**
 * The whole «شابع» page: announcement + header, the visible sections in order, footer, the
 * sticky order bar and WhatsApp. The Builder draws it too (parts selectable, tools over them).
 */
export function ShabePage({
  content,
  data,
  mode = "live",
  selected = null,
  onSelect,
  tools,
  media = {},
}: {
  content: ShabeContent;
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
    <ShabeRoot settings={settings} data={data} mode={mode} media={media} className="min-h-full">
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
    </ShabeRoot>
  );
}
