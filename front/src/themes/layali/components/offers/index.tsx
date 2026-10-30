"use client";

import { Crown } from "lucide-react";
import { formatPrice } from "@/lib/price";
import { Countdown } from "@/themes/shared/components/countdown";
import { PreviewEmpty } from "@/themes/shared/components/preview-empty";
import { chooseOfferQuantity } from "@/themes/shared/hooks/offer-store";
import { useLiveOffers } from "@/themes/shared/hooks/use-live-offers";
import type { OffersProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";

/** «ليالي» offers: glass cards with the best one glowing, or one spotlight offer with its countdown. */
export function LayaliOffers({ props, variant, ctx }: SectionProps<OffersProps>) {
  const { displays, best, expire } = useLiveOffers(ctx);

  if (displays.length === 0) {
    if (props.empty_behavior === "message" && props.empty_message) {
      return (
        <section className="px-4 py-14">
          <p className="l-glass t-muted mx-auto max-w-2xl rounded-3xl p-6 text-center">{props.empty_message}</p>
        </section>
      );
    }
    return <PreviewEmpty ctx={ctx} label={props.title} />;
  }

  if (variant === "spotlight" && best) {
    const offer = best.offer;
    return (
      <section className="relative px-4 py-20">
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-[2.25rem] p-[1px]" style={{ background: "linear-gradient(135deg, var(--c-primary), transparent 45%, var(--c-accent))" }}>
          <div className="relative flex flex-col items-center gap-5 rounded-[2.2rem] px-6 py-12 text-center sm:px-12" style={{ background: "color-mix(in srgb, var(--c-bg) 92%, var(--c-primary))" }}>
            <div className="l-aurora opacity-60" aria-hidden />
            <span className="l-eyebrow relative">{offer.badge_text || siteMessages.savePercent(best.savingsPercent)}</span>
            <h2 className="t-heading l-grad-text relative text-3xl font-bold md:text-5xl">{props.title || offer.name}</h2>
            <p className="t-muted relative text-lg">
              {offer.type === "bundle" ? siteMessages.buyQuantity(best.quantity, formatPrice(best.total)) : offer.name}
              {props.show_savings && best.savings > 0 ? ` — ${siteMessages.save(formatPrice(best.savings))}` : ""}
            </p>
            {props.show_countdown && offer.ends_at ? <Countdown endsAt={offer.ends_at} onExpire={() => expire(offer.id)} className="relative" boxClassName="l-glass rounded-2xl" labelClassName="t-muted" /> : null}
            <button type="button" onClick={() => chooseOfferQuantity(best.quantity)} className="t-primary t-btn l-glow-btn relative mt-2 min-h-14 px-10 font-bold">
              {props.cta_label || siteMessages.orderNow}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          {props.title ? <h2 className="t-heading l-grad-text text-3xl font-bold md:text-4xl">{props.title}</h2> : null}
          {props.subtitle ? <p className="t-muted mt-4">{props.subtitle}</p> : null}
        </div>
        <ul data-reveal-stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {displays.map((d) => {
            const top = best?.offer.id === d.offer.id && displays.length > 1;
            return (
              <li key={d.offer.id} className={cn("l-glass relative flex flex-col items-center gap-3 rounded-[1.75rem] p-7 text-center", top && "shadow-[0_0_0_1px_var(--c-accent),0_30px_70px_-25px_var(--c-primary)] lg:-translate-y-3")}>
                {d.offer.badge_text || top ? (
                  <span className="absolute -top-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold" style={{ background: "linear-gradient(90deg, var(--c-primary), var(--c-accent))", color: "var(--c-primary-fg)" }}>
                    {top ? <Crown className="size-3.5" aria-hidden /> : null}
                    {d.offer.badge_text || siteMessages.bestSeller}
                  </span>
                ) : null}
                <h3 className="t-heading mt-2 text-lg font-bold">{d.offer.name}</h3>
                <p className="t-heading text-4xl font-bold tabular-nums">{formatPrice(d.total)}</p>
                <p className="t-muted text-sm">
                  {d.offer.type === "bundle" ? siteMessages.pieces(d.quantity) : siteMessages.perPiece(formatPrice(d.unit))}
                  {d.quantity > 1 ? ` · ${siteMessages.perPiece(formatPrice(d.unit))}` : ""}
                </p>
                {props.show_savings && d.savings > 0 ? <p className="rounded-full px-3 py-1 text-sm font-semibold text-[var(--c-accent)] ring-1 ring-[var(--c-accent)]/40">{siteMessages.save(formatPrice(d.savings))}</p> : null}
                {props.show_countdown && d.offer.ends_at ? <Countdown endsAt={d.offer.ends_at} onExpire={() => expire(d.offer.id)} boxClassName="l-glass rounded-xl" labelClassName="t-muted" numberClassName="text-lg" /> : null}
                <button type="button" onClick={() => chooseOfferQuantity(d.quantity)} className={cn("t-btn mt-auto min-h-12 w-full px-6 font-bold", top ? "t-primary l-glow-btn" : "l-glass")}>
                  {props.cta_label || siteMessages.orderNow}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
