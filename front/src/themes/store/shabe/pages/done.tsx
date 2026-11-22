"use client";

import { ChefHat } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { PayNowBox } from "@/themes/shared/payment-choice";
import { StoreLink } from "@/themes/store/shared/context";
import { UpsellOffer } from "../../../upsell-offer";

const t = ar.storefront.done;

/** After the order, in «شابع»'s look: its number and total, the after-order offer, tracking. */
export function ShabeOrderDone({ orderNumber, total: initialTotal, pay = null }: { orderNumber: number | null; total: number | null; pay?: string | null }) {
  const [total, setTotal] = React.useState(initialTotal);
  return (
    <div className="ss-wrap flex justify-center py-12 @3xl:py-16">
      <div className="ss-card flex w-full max-w-lg flex-col items-center gap-4 p-7 text-center @3xl:p-10">
        <span className="flex size-20 items-center justify-center rounded-full bg-(--as-primary) text-(--as-on-primary) shadow-[0_18px_36px_-16px_var(--as-primary)]">
          <ChefHat className="size-10" aria-hidden />
        </span>
        <h1 className="ss-display ss-title">{t.title}</h1>
        {orderNumber ? <p className="ss-display as-2xl text-(--as-primary)">{t.number(orderNumber)}</p> : null}
        <p className="as-base as-muted">{t.text}</p>
        {pay ? <PayNowBox href={`/pay/${pay}`} /> : null}
        {total !== null ? (
          <p className="as-base flex w-full justify-between rounded-2xl bg-(--ss-soft) px-5 py-3">
            <span className="as-muted">{t.total}</span>
            <b className="font-black">{formatMoney(total)}</b>
          </p>
        ) : null}
        <UpsellOffer orderNumber={orderNumber} onTotal={setTotal} />
        <div className="flex w-full flex-col gap-2">
          <StoreLink href={orderNumber ? `/track?order=${orderNumber}` : "/track"} className="ss-btn ss-btn-fire as-base h-12 w-full">
            {t.track}
          </StoreLink>
          <StoreLink href="/products" className="as-sm py-2 font-extrabold text-(--as-primary) hover:underline">
            {t.shop}
          </StoreLink>
        </div>
      </div>
    </div>
  );
}
