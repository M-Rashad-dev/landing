"use client";

import { CheckCircle2, Gift } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { clearUpsell, readUpsell, type UpsellOfferData } from "@/lib/store/upsell";
import { ar } from "@/messages/ar";

const t = ar.growth.offer;

type State = "offer" | "adding" | "added" | "closed" | "skipped";

/**
 * The one-click offer on the thank-you screen (store and landing pages): adds one more product
 * to the order just placed, at the offer price, with no second checkout. Styled by the theme's
 * `as-*` classes, so it fits whichever theme draws the page.
 */
export function UpsellOffer({ orderNumber, onTotal }: { orderNumber: number | null; onTotal?: (total: number) => void }) {
  const [offer, setOffer] = React.useState<UpsellOfferData | null>(null);
  const [state, setState] = React.useState<State>("offer");
  const [total, setTotal] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (orderNumber === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this tab's storage after the page loads
    setOffer(readUpsell(orderNumber));
  }, [orderNumber]);

  if (!offer || orderNumber === null || state === "skipped") return null;

  async function accept() {
    if (!offer || orderNumber === null) return;
    setState("adding");
    try {
      const response = await fetch("/api/public/upsell", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ order_number: orderNumber, upsell_id: offer.id, token: offer.token }),
        credentials: "same-origin",
      });
      const json = (await response.json().catch(() => ({}))) as { data?: { total: number } };
      clearUpsell();
      if (!response.ok || !json.data) {
        setState("closed");
        return;
      }
      setTotal(json.data.total);
      setState("added");
      onTotal?.(json.data.total);
    } catch {
      setState("offer");
    }
  }

  if (state === "added" || state === "closed") {
    return (
      <div role="status" className="as-sm flex w-full items-center gap-2 rounded-xl bg-(--as-soft) p-3 text-start font-semibold">
        <CheckCircle2 className="size-5 shrink-0 as-primary" aria-hidden />
        {state === "added" ? `${t.added} ${total !== null ? t.newTotal(total) : ""}` : t.closed}
      </div>
    );
  }

  const image = offer.product.image?.urls.medium ?? offer.product.image?.urls.thumb ?? Object.values(offer.product.image?.urls ?? {})[0] ?? null;
  const off = offer.regular_price > offer.price ? Math.round((1 - offer.price / offer.regular_price) * 100) : 0;

  return (
    <section aria-label={t.title} className="flex w-full flex-col gap-3 rounded-2xl border-2 border-dashed border-(--as-primary) p-4 text-start">
      <p className="as-xs flex items-center gap-1.5 font-bold as-primary">
        <Gift className="size-4" aria-hidden />
        {t.title}
      </p>
      <div className="flex items-center gap-3">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- media URLs come from the store's own storage
          <img src={image} alt={offer.product.image?.alt ?? offer.product.name} className="size-20 shrink-0 rounded-xl object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="as-base font-extrabold">{offer.headline}</p>
          {offer.description ? <p className="as-sm as-muted">{offer.description}</p> : null}
          <p className="as-sm mt-1 flex flex-wrap items-baseline gap-2">
            <b className="as-lg as-primary">{formatMoney(offer.price)}</b>
            {off > 0 ? (
              <>
                <s className="as-muted">{formatMoney(offer.regular_price)}</s>
                <span className="as-xs rounded-full bg-(--as-soft) px-2 py-0.5 font-bold">{t.off(off)}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>
      <button type="button" onClick={() => void accept()} disabled={state === "adding"} className="as-btn as-base h-12 w-full disabled:opacity-60">
        {state === "adding" ? t.adding : t.add}
      </button>
      <button type="button" onClick={() => (clearUpsell(), setState("skipped"))} className="as-sm as-muted self-center font-semibold hover:underline">
        {t.skip}
      </button>
    </section>
  );
}
