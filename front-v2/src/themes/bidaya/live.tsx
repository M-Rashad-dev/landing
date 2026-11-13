"use client";

import { CheckCircle2, PackageSearch } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import type { LandingPayload } from "@/lib/public/landing";
import { TrackingScripts } from "@/lib/tracking/scripts";
import { track } from "@/lib/tracking/track";
import { ar } from "@/messages/ar";
import { BidayaRoot } from "./context";
import { BidayaPage } from "./page";
import type { LandingData } from "./types";
import { UpsellOffer } from "../upsell-offer";
import { PLACED_KEY, sendPageEvent, type Placed } from "./use-order";

const t = ar.bidaya.done;

export function landingData(payload: LandingPayload): LandingData {
  return {
    page: { id: payload.page.id, slug: payload.page.slug, title: payload.page.title },
    store_name: payload.store_name,
    product: payload.product,
    offers: payload.offers,
    media: payload.media,
    reviews: payload.reviews,
    shipping: payload.shipping,
  };
}

/** The live page: the theme, the merchant's pixels, the visit counter and «ViewContent». */
export function LandingLive({ payload }: { payload: LandingPayload }) {
  const data = landingData(payload);
  React.useEffect(() => {
    sendPageEvent(payload.page.slug, "view");
    const product = payload.product;
    if (!product) return;
    // Pixels load after the page: give them a moment before the event.
    const timer = window.setTimeout(() => track("ViewContent", { content_ids: [product.id], content_name: product.name, value: product.price, num_items: 1 }), 1200);
    return () => window.clearTimeout(timer);
  }, [payload.page.slug, payload.product]);

  return (
    <>
      <BidayaPage content={payload.content} data={data} mode="live" />
      <TrackingScripts tracking={payload.tracking} />
    </>
  );
}

/** «طلبك وصل»: the order number, and the purchase event once for this order. */
export function LandingDone({ payload, orderNumber }: { payload: LandingPayload; orderNumber: number | null }) {
  const data = landingData(payload);
  const [placed, setPlaced] = React.useState<Placed | null>(null);

  React.useEffect(() => {
    let order: Placed | null = null;
    try {
      const raw = window.sessionStorage.getItem(PLACED_KEY);
      order = raw ? (JSON.parse(raw) as Placed) : null;
    } catch {
      order = null;
    }
    if (!order || order.slug !== payload.page.slug || (orderNumber !== null && order.number !== orderNumber)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this tab's storage after the page loads
    setPlaced(order);
    const flag = `bd_conv_${order.number}`;
    try {
      if (window.sessionStorage.getItem(flag) === "1") return;
      window.sessionStorage.setItem(flag, "1");
    } catch {
      // Storage blocked: the event still goes once in this visit.
    }
    const event = payload.tracking?.conversion_event === "Lead" ? "Lead" : "Purchase";
    const sent = order;
    const timer = window.setTimeout(() => track(event, { content_ids: [sent.product_id], content_name: sent.product_name, value: sent.total, num_items: sent.quantity, transaction_id: sent.number }), 1200);
    return () => window.clearTimeout(timer);
  }, [payload.page.slug, payload.tracking, orderNumber]);

  const number = placed?.number ?? orderNumber;
  return (
    <>
      <BidayaRoot settings={payload.content.settings} data={data} mode="live" className="flex min-h-dvh items-center justify-center px-4 py-12">
        <div className="bd-card flex w-full max-w-md flex-col items-center gap-4 p-7 text-center">
          <CheckCircle2 className="size-16 text-green-600" aria-hidden />
          <h1 className="as-2xl font-extrabold">{t.title}</h1>
          <p className="as-sm as-muted">{t.text}</p>
          {number ? (
            <dl className="as-sm grid w-full grid-cols-2 gap-2">
              <div className="rounded-xl bg-(--as-soft) p-3">
                <dt className="as-muted">{t.number}</dt>
                <dd className="as-xl font-extrabold">#{number}</dd>
              </div>
              {placed ? (
                <div className="rounded-xl bg-(--as-soft) p-3">
                  <dt className="as-muted">{t.total}</dt>
                  <dd className="as-xl font-extrabold">{formatMoney(placed.total)}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <UpsellOffer orderNumber={number ?? null} onTotal={(total) => setPlaced((p) => (p ? { ...p, total } : p))} />
          <a href="/track" className="as-btn as-base h-12 w-full">
            <PackageSearch className="size-5" aria-hidden />
            {t.track}
          </a>
          <a href={`/${encodeURIComponent(payload.page.slug)}`} className="as-sm as-muted font-semibold hover:underline">
            {t.back}
          </a>
        </div>
      </BidayaRoot>
      <TrackingScripts tracking={payload.tracking} />
    </>
  );
}
