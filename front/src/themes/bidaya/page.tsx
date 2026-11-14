"use client";

import { MessageCircle, Phone } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { SocialIcon } from "@/themes/asas/icons";
import { SOCIALS, type MediaUrls } from "@/themes/asas/types";
import { BidayaRoot, imageSrc, scrollToOrder, useImage, usePage, type PageMode } from "./context";
import { OrderForm } from "./order-form";
import { Faq, Features, Gallery, Hero, Testimonials, usePrice } from "./sections";
import type { Content, LandingData, Section } from "./types";

const t = ar.bidaya;

export type Selection = string | "header" | "footer" | null;

const waLink = (number: string) => `https://wa.me/${number.replace(/\D/g, "").replace(/^0/, "20")}`;

function Header() {
  const { settings, data } = usePage();
  const logo = imageSrc(useImage(settings.logo_media_id), "medium");
  return (
    <header>
      {settings.header.announcement ? <p className="as-sm bg-(--as-primary) px-4 py-2 text-center font-semibold text-(--as-on-primary)">{settings.header.announcement}</p> : null}
      {settings.header.show ? (
        <div className="flex h-16 items-center justify-center border-b px-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- store logo from the media server
            <img src={logo} alt={data.store_name} className="h-10 w-auto max-w-[10rem] object-contain" />
          ) : (
            <span className="as-xl font-extrabold">{data.store_name}</span>
          )}
        </div>
      ) : null}
    </header>
  );
}

function Footer() {
  const { settings, data } = usePage();
  const f = settings.footer;
  const socials = SOCIALS.filter((s) => f.social[s]);
  return (
    <footer className="border-t px-4 pb-24 pt-8 @3xl:pb-10">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        {f.text ? <p className="as-sm as-muted max-w-lg">{f.text}</p> : null}
        {f.phone || f.whatsapp ? (
          <div className="as-sm flex flex-wrap justify-center gap-4 font-semibold">
            {f.phone ? (
              <a href={`tel:${f.phone}`} className="flex items-center gap-1.5" dir="ltr">
                <Phone className="size-4 as-primary" aria-hidden />
                {f.phone}
              </a>
            ) : null}
            {f.whatsapp ? (
              <a href={waLink(f.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                <MessageCircle className="size-4 as-primary" aria-hidden />
                {t.footer.whatsapp}
              </a>
            ) : null}
          </div>
        ) : null}
        {socials.length ? (
          <ul className="flex gap-2">
            {socials.map((network) => (
              <li key={network}>
                <a href={f.social[network]!} target="_blank" rel="noopener noreferrer" aria-label={network} className="flex size-9 items-center justify-center rounded-full bg-(--as-soft) as-primary hover:brightness-95">
                  <SocialIcon network={network} className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="as-xs as-muted">{t.footer.rights(data.store_name)}</p>
      </div>
    </footer>
  );
}

/** Phones: the price and «اطلب دلوقتي» stay at the bottom until the order form is on screen. */
function StickyOrder({ label }: { label: string }) {
  const { mode } = usePage();
  const price = usePrice();
  const [formVisible, setFormVisible] = React.useState(false);
  React.useEffect(() => {
    const form = document.getElementById("order");
    if (!form || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(form);
    return () => observer.disconnect();
  }, []);
  return (
    <div className={cn("sticky bottom-0 z-20 border-t bg-(--as-bg)/95 px-4 py-3 backdrop-blur transition-transform @3xl:hidden", formVisible && "pointer-events-none translate-y-full opacity-0")}>
      <div className="flex items-center gap-3">
        {price ? (
          <span className="flex flex-col leading-tight">
            <b className="as-lg as-primary">{formatMoney(price.now)}</b>
            {price.was ? <span className="as-xs as-muted line-through">{formatMoney(price.was)}</span> : null}
          </span>
        ) : null}
        <button type="button" onClick={() => scrollToOrder(mode)} className="as-btn as-base h-12 flex-1">
          {label}
        </button>
      </div>
    </div>
  );
}

function WhatsappFloat({ number }: { number: string }) {
  return (
    <a href={waLink(number)} target="_blank" rel="noopener noreferrer" aria-label={t.footer.whatsapp} className="fixed bottom-24 end-4 z-30 flex size-13 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg @3xl:bottom-6">
      <MessageCircle className="size-6" />
    </a>
  );
}

function SectionView({ section }: { section: Section }) {
  switch (section.type) {
    case "hero":
      return <Hero props={section.props} />;
    case "features":
      return <Features props={section.props} />;
    case "gallery":
      return <Gallery props={section.props} />;
    case "testimonials":
      return <Testimonials props={section.props} />;
    case "faq":
      return <Faq props={section.props} />;
    case "order_form":
      return <OrderForm props={section.props} />;
  }
}

/**
 * The whole «بداية» page: header, the visible sections in order, footer, the sticky order bar.
 * The Builder draws it too (parts selectable, quick actions over the selected one).
 */
export function BidayaPage({
  content,
  data,
  mode = "live",
  selected = null,
  onSelect,
  tools,
  media = {},
}: {
  content: Content;
  data: LandingData;
  mode?: PageMode;
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
  const hero = content.sections.find((s) => s.type === "hero" && s.visible);
  const ctaLabel = hero?.type === "hero" ? hero.props.button_label : t.orderNow;

  return (
    <BidayaRoot settings={settings} data={data} mode={mode} media={media} className="min-h-full">
      <div className={frame("header")} onClickCapture={builder ? select("header") : undefined}>
        <Header />
        {toolsOf("header")}
      </div>
      <main>
        {content.sections
          .filter((s) => s.visible)
          .map((s) => (
            <div key={s.id} id={`section-${s.id}`} className={frame(s.id)} onClickCapture={builder ? select(s.id) : undefined}>
              <SectionView section={s} />
              {toolsOf(s.id)}
            </div>
          ))}
      </main>
      <div className={frame("footer")} onClickCapture={builder ? select("footer") : undefined}>
        <Footer />
        {toolsOf("footer")}
      </div>
      {settings.general.sticky_order_button ? <StickyOrder label={ctaLabel} /> : null}
      {settings.general.whatsapp_button && settings.footer.whatsapp && !builder ? <WhatsappFloat number={settings.footer.whatsapp} /> : null}
    </BidayaRoot>
  );
}
