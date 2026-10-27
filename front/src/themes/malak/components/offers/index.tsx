"use client";

import { Gift } from "lucide-react";
import { formatPrice } from "@/lib/price";
import { Countdown } from "@/themes/shared/components/countdown";
import { PreviewEmpty } from "@/themes/shared/components/preview-empty";
import { chooseOfferQuantity } from "@/themes/shared/hooks/offer-store";
import { useLiveOffers } from "@/themes/shared/hooks/use-live-offers";
import type { OffersProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { siteMessages } from "@/messages/site";

export function MalakOffers({ props, variant, ctx }: SectionProps<OffersProps>) {
  const { displays, best, expire } = useLiveOffers(ctx);

  if (displays.length === 0) {
    if (props.empty_behavior === "message" && props.empty_message) {
      return (
        <section className="px-4 py-12">
          <p className="t-tint t-muted mx-auto max-w-2xl rounded-3xl p-6 text-center font-medium">{props.empty_message}</p>
        </section>
      );
    }
    return <PreviewEmpty ctx={ctx} label={props.title} />;
  }

  const heading = (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {props.title ? <h2 className="t-heading text-2xl font-bold md:text-3xl">{props.title}</h2> : null}
      {props.subtitle ? <p className="t-muted mt-3">{props.subtitle}</p> : null}
    </div>
  );

  if (variant === "ribbon-banner" && best) {
    const offer = best.offer;
    return (
      <section className="px-4 py-12">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl p-8 text-center shadow-[0_8px_30px_rgba(0,0,0,.12)] sm:p-12" style={{ background: "linear-gradient(120deg, var(--c-primary), color-mix(in srgb, var(--c-primary) 55%, var(--c-accent)))", color: "var(--c-primary-fg)" }}>
          <div className="absolute -start-10 -top-10 size-40 rounded-full bg-white/10" aria-hidden />
          <div className="absolute -bottom-12 -end-8 size-48 rounded-full bg-white/10" aria-hidden />
          <div className="relative flex flex-col items-center gap-4">
            <span className="rounded-full bg-white/20 px-4 py-1 text-xs font-bold">{offer.badge_text || siteMessages.savePercent(best.savingsPercent)}</span>
            <h2 className="t-heading text-2xl font-bold md:text-4xl">{props.title || offer.name}</h2>
            <p className="text-lg opacity-90">
              {offer.type === "bundle" ? siteMessages.buyQuantity(best.quantity, formatPrice(best.total)) : offer.name} {props.show_savings && best.savings > 0 ? `— ${siteMessages.save(formatPrice(best.savings))}` : ""}
            </p>
            {props.show_countdown && offer.ends_at ? (
              <Countdown endsAt={offer.ends_at} onExpire={() => expire(offer.id)} boxClassName="rounded-2xl bg-white/15" labelClassName="opacity-80" />
            ) : null}
            <button type="button" onClick={() => chooseOfferQuantity(best.quantity)} className="t-btn mt-2 min-h-12 bg-white px-8 font-bold text-gray-900 shadow">
              {props.cta_label || siteMessages.orderNow}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="t-tint px-4 py-16 md:py-24">
      <div className="mx-auto max-w-5xl">
        {heading}
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {displays.map((d) => (
            <li key={d.offer.id} className="t-bg relative flex flex-col items-center gap-3 rounded-3xl p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,.06)]">
              {d.offer.badge_text ? <span className="t-accent absolute -top-3 rounded-full px-3 py-1 text-xs font-bold">{d.offer.badge_text}</span> : null}
              <span className="t-tint flex size-12 items-center justify-center rounded-full">
                <Gift className="size-6 t-primary-text" aria-hidden />
              </span>
              <h3 className="t-heading text-lg font-bold">{d.offer.name}</h3>
              <p className="text-3xl font-extrabold tabular-nums t-primary-text">{formatPrice(d.total)}</p>
              <p className="t-muted text-sm">
                {d.offer.type === "bundle" ? siteMessages.pieces(d.quantity) : siteMessages.perPiece(formatPrice(d.unit))}
                {d.quantity > 1 ? ` · ${siteMessages.perPiece(formatPrice(d.unit))}` : ""}
              </p>
              {props.show_savings && d.savings > 0 ? <p className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">{siteMessages.save(formatPrice(d.savings))}</p> : null}
              {props.show_countdown && d.offer.ends_at ? <Countdown endsAt={d.offer.ends_at} onExpire={() => expire(d.offer.id)} boxClassName="t-tint rounded-xl" labelClassName="t-muted" numberClassName="text-lg" /> : null}
              <button type="button" onClick={() => chooseOfferQuantity(d.quantity)} className="t-primary t-btn mt-auto min-h-11 w-full px-6 font-bold">
                {props.cta_label || siteMessages.orderNow}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
