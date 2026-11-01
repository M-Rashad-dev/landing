import { describe, expect, it } from "vitest";
import type { PublicOffer } from "@/themes/types";
import { estimateQuote } from "./estimate";
import { describeOffer, offerQuantity, offerTotalCents, pickOffer } from "./offers";

const offer = (o: Partial<PublicOffer>): PublicOffer => ({
  id: 1,
  name: "عرض",
  type: "percentage",
  value: null,
  bundle_quantity: null,
  bundle_price: null,
  starts_at: null,
  ends_at: null,
  status: "active",
  badge_text: null,
  priority: 0,
  min_quantity: 1,
  free_quantity: null,
  gift: null,
  ...o,
});

const percent = offer({ id: 1, name: "اشترِ 2 وخد 20%", type: "percentage", value: 20, min_quantity: 2 });
const buyGet = offer({ id: 2, name: "اشترِ 5 والسادسة مجانًا", type: "buy_get", min_quantity: 5, free_quantity: 1 });
const gift = offer({ id: 3, name: "شراب هدية", type: "gift", gift: { id: 9, name: "شراب", price: 80 } });

describe("offer rules (same as the server)", () => {
  it("applies minimum quantities, buy-X-get-Y and gifts", () => {
    expect(offerTotalCents(percent, 1000, 1)).toBeNull();
    expect(offerTotalCents(percent, 1000, 2)).toBe(160000);
    expect(offerTotalCents(buyGet, 1000, 6)).toBe(500000);
    expect(offerTotalCents(buyGet, 1000, 5)).toBeNull();
    expect(offerTotalCents(gift, 1000, 1)).toBe(100000);
    expect([offerQuantity(percent), offerQuantity(buyGet), offerQuantity(gift)]).toEqual([2, 6, 1]);
    expect(describeOffer(gift, { price: 1000 })?.savings).toBe(80);
  });

  it("picks by merchant priority, then the lowest total, and honors a forced choice", () => {
    expect(pickOffer([percent, buyGet, gift], 1000, 6)?.offer.id).toBe(1);
    expect(pickOffer([percent, { ...buyGet, priority: 3 }, gift], 1000, 6)?.offer.id).toBe(2);
    expect(pickOffer([percent, buyGet, gift], 1000, 1)?.offer.id).toBe(3);
    expect(pickOffer([percent, buyGet, gift], 1000, 6, 0, 3)?.offer.id).toBe(3);
    expect(pickOffer([percent, buyGet, gift], 1000, 6, 0, 0)).toBeNull();
  });

  it("estimates the gift line and explains a chosen offer that needs more pieces", () => {
    const product = { id: 1, name: "حذاء", description: null, price: 1000, compare_at_price: null, available: true, images: [], options: [] };
    expect(estimateQuote(product, [gift], 1, {}).gift).toEqual({ product_id: 9, name: "شراب", value: 80 });
    const q = estimateQuote(product, [percent], 1, {}, 1);
    expect(q.offer).toBeNull();
    expect(q.offer_error).toBe("العرض ده محتاج 2 قطعة على الأقل.");
  });
});
