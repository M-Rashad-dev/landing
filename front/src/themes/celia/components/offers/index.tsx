"use client";

import { formatPrice } from "@/lib/price";
import { Countdown } from "@/themes/shared/components/countdown";
import { PreviewEmpty } from "@/themes/shared/components/preview-empty";
import { chooseOfferQuantity } from "@/themes/shared/hooks/offer-store";
import { useLiveOffers } from "@/themes/shared/hooks/use-live-offers";
import type { OffersProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";

export function CeliaOffers({ props, variant, ctx }: SectionProps<OffersProps>) {
  const { displays, best, expire } = useLiveOffers(ctx);

  if (displays.length === 0) {
    if (props.empty_behavior === "message" && props.empty_message) {
      return (
        <section className="t-bg border-t-[3px] t-line px-4 py-10">
          <p className="mx-auto max-w-3xl border-2 border-dashed t-line p-6 text-center font-bold">{props.empty_message}</p>
        </section>
      );
    }
    return <PreviewEmpty ctx={ctx} label={props.title} />;
  }

  if (variant === "countdown-strip" && best) {
    const offer = best.offer;
    return (
      <section className="t-inverse border-y-[3px] t-line px-4 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-start">
          <div className="flex flex-col gap-2">
            <span className="t-accent self-center px-3 py-1 text-xs font-black uppercase md:self-start">{offer.badge_text || siteMessages.savePercent(best.savingsPercent)}</span>
            <h2 className="t-heading text-3xl font-black uppercase tracking-tight md:text-4xl">{props.title || offer.name}</h2>
            <p className="text-lg opacity-80">
              {offer.type === "bundle" ? siteMessages.buyQuantity(best.quantity, formatPrice(best.total)) : offer.name}
              {props.show_savings && best.savings > 0 ? ` — ${siteMessages.save(formatPrice(best.savings))}` : ""}
            </p>
          </div>
          {props.show_countdown && offer.ends_at ? (
            <Countdown endsAt={offer.ends_at} onExpire={() => expire(offer.id)} boxClassName="border-2 min-w-16 border-[var(--c-bg)]" numberClassName="text-4xl font-black" labelClassName="font-bold opacity-80" />
          ) : null}
          <button type="button" onClick={() => chooseOfferQuantity(best.quantity)} className="t-accent t-btn min-h-14 border-2 border-[var(--c-bg)] px-8 text-lg font-black shadow-[4px_4px_0_var(--c-bg)]">
            {props.cta_label || siteMessages.orderNow}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="t-bg border-t-[3px] t-line px-4 py-12 md:py-16">
      <div className="mx-auto max-w-6xl">
        {props.title ? <h2 className="t-heading text-3xl font-black uppercase tracking-tight md:text-5xl">{props.title}</h2> : null}
        {props.subtitle ? <p className="t-muted mb-10 mt-2">{props.subtitle}</p> : <div className="mb-10" />}
        <ul data-reveal-stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {displays.map((d) => {
            const top = best?.offer.id === d.offer.id && displays.length > 1;
            return (
              <li key={d.offer.id}>
                <button type="button" onClick={() => chooseOfferQuantity(d.quantity)} className={cn("t-hard t-press relative flex h-full w-full flex-col items-start gap-2 p-6 text-start", top ? "t-primary" : "t-bg")}>
                  {top ? <span className="t-accent absolute -top-3 end-4 border-2 t-line px-2 py-0.5 text-xs font-black">{siteMessages.bestSeller}</span> : null}
                  <span className="text-sm font-extrabold uppercase opacity-80">{d.offer.type === "bundle" ? siteMessages.pieces(d.quantity) : d.offer.name}</span>
                  <span className="text-5xl font-black tabular-nums tracking-tight">{formatPrice(d.total)}</span>
                  <span className="text-sm font-bold opacity-80">{siteMessages.perPiece(formatPrice(d.unit))}</span>
                  {props.show_savings && d.savings > 0 ? <span className="mt-2 border-2 border-current px-2 py-0.5 text-sm font-black">{siteMessages.save(formatPrice(d.savings))}</span> : null}
                  {props.show_countdown && d.offer.ends_at ? <Countdown endsAt={d.offer.ends_at} onExpire={() => expire(d.offer.id)} className="mt-3" boxClassName="border-2 border-current" numberClassName="text-lg" /> : null}
                  <span className="mt-auto pt-4 text-sm font-black underline underline-offset-4">{props.cta_label || siteMessages.orderNow}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
