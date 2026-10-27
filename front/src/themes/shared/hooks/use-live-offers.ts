"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { describeOffer, type OfferDisplay } from "@/lib/price/offers";
import type { PageContext, PublicOffer } from "@/themes/types";

/**
 * Active offers with display math; an offer whose countdown ends disappears
 * immediately and the page data is refreshed in the background (live pages only).
 */
export function useLiveOffers(ctx: PageContext) {
  const router = useRouter();
  const [expired, setExpired] = useState<number[]>([]);

  const displays = useMemo(() => {
    if (!ctx.product) return [];
    return ctx.offers
      .filter((offer: PublicOffer) => offer.status === "active" && !expired.includes(offer.id))
      .map((offer) => describeOffer(offer, ctx.product!))
      .filter((d): d is OfferDisplay => d !== null);
  }, [ctx.offers, ctx.product, expired]);

  const expire = useCallback(
    (id: number) => {
      setExpired((current) => (current.includes(id) ? current : [...current, id]));
      if (!ctx.isPreview) router.refresh();
    },
    [ctx.isPreview, router],
  );

  const best = displays.reduce<OfferDisplay | null>((top, d) => (!top || d.savingsPercent > top.savingsPercent ? d : top), null);

  return { displays, best, expire };
}
