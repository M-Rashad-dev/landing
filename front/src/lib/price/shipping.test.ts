import { describe, expect, it } from "vitest";
import type { Quote } from "@/lib/types";
import { withShipping } from "./shipping";

const quote = { currency: "EGP", unit_price: 300, quantity: 2, base_subtotal: 600, offer: null, subtotal_after_offer: 600, code: null, code_error: null, total: 600 } satisfies Quote;
const shipping = { enabled: true as const, fees: { القاهرة: 50, أسوان: 90 }, unavailable: ["شمال سيناء"], free_over: 1000 };

describe("delivery fee estimate", () => {
  it("does nothing while shipping is off", () => {
    expect(withShipping(quote, { enabled: false }, "القاهرة")).toBe(quote);
    expect(withShipping(quote, undefined, "القاهرة")).toBe(quote);
    expect(withShipping({ ...quote, shipping: null, shipping_available: true }, { enabled: false }, "القاهرة")).not.toHaveProperty("shipping");
  });

  it("waits for the governorate, then adds its fee", () => {
    expect(withShipping(quote, shipping, "")).toMatchObject({ shipping: null, total: 600 });
    expect(withShipping(quote, shipping, "أسوان")).toMatchObject({ shipping: 90, items_total: 600, total: 690 });
  });

  it("is free above the threshold and flags closed governorates", () => {
    expect(withShipping({ ...quote, total: 1200 }, shipping, "القاهرة")).toMatchObject({ shipping: 0, shipping_free: true, total: 1200 });
    expect(withShipping(quote, shipping, "شمال سيناء")).toMatchObject({ shipping: null, shipping_available: false });
  });

  it("does not add the fee twice to a server quote that already has it", () => {
    const server = { ...quote, items_total: 600, shipping: 50, total: 650 };
    expect(withShipping(server, shipping, "القاهرة")).toMatchObject({ shipping: 50, total: 650 });
  });
});
