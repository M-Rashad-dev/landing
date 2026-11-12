import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { isoToCairoInput } from "@/lib/format";
import { ar } from "@/messages/ar";
import { CODE_PATTERN, CouponDrawer, couponSummary, randomCode } from "./coupons/coupon-drawer";
import { basePayload } from "./form-utils";
import { offerSummary } from "./offers/offer-drawer";
import { shippingOfferSummary } from "./shipping-offers/shipping-offer-drawer";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes("/dashboard/categories")) return Response.json({ data: [] });
    if (String(url).includes("/dashboard/products")) return Response.json({ data: [{ id: 7, name: "ساعة", price: 900 }], meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 } });
    return Response.json({ data: { id: 1 } }, { status: 201 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("summaries the customer reads (also the default names)", () => {
  it("describes product offers", () => {
    const base = { value: "", min_quantity: "", bundle_quantity: "", bundle_price: "", free_quantity: "" };
    expect(offerSummary({ ...base, type: "percentage", value: "10", min_quantity: "2" }, "")).toBe("خصم 10% لما يشتري قطعتين أو أكتر");
    expect(offerSummary({ ...base, type: "bundle", bundle_quantity: "3", bundle_price: "500" }, "")).toBe("3 قطع بـ 500 ج.م");
    expect(offerSummary({ ...base, type: "buy_get", min_quantity: "2", free_quantity: "1" }, "")).toBe("اشتري قطعتين وخد قطعة مجانًا");
    expect(offerSummary({ ...base, type: "gift" }, "شراب")).toBe("شراب مجانًا مع الطلب");
  });

  it("describes shipping offers with their conditions", () => {
    expect(shippingOfferSummary({ benefit: "free", value: "", min_quantity: "3", min_total: "" })).toBe("شحن مجاني لما يشتري 3 قطع");
    expect(shippingOfferSummary({ benefit: "flat", value: "20", min_quantity: "", min_total: "1000" })).toBe("الشحن بـ 20 ج.م للطلبات من 1,000 ج.م");
    expect(shippingOfferSummary({ benefit: "discount", value: "15", min_quantity: "2", min_total: "500" })).toBe("خصم 15 ج.م على الشحن لما يشتري قطعتين وللطلبات من 500 ج.م");
  });

  it("describes coupons", () => {
    expect(couponSummary({ type: "percentage", value: "10", max_discount: "150", min_order_total: "", min_quantity: "", first_order_only: true })).toBe("خصم 10% (لحد 150 ج.م) · لأول طلب");
    expect(couponSummary({ type: "free_shipping", value: "", max_discount: "", min_order_total: "300", min_quantity: "", first_order_only: false })).toBe("شحن مجاني · للطلبات من 300 ج.م");
  });
});

describe("form helpers", () => {
  it("makes codes the back end accepts", () => {
    for (let i = 0; i < 20; i++) expect(randomCode()).toMatch(CODE_PATTERN);
  });

  it("shows saved times in Cairo for the picker", () => {
    expect(isoToCairoInput("2026-11-20T10:30:00Z")).toBe("2026-11-20T12:30");
    expect(isoToCairoInput(null)).toBe("");
  });

  it("sends only the list that matches the target", () => {
    const v = { applies_to: "categories" as const, product_ids: [1, 2], category_ids: [5], starts_at: "", ends_at: "2026-12-01T10:00", is_active: true };
    expect(basePayload(v)).toEqual({ applies_to: "categories", product_ids: [], category_ids: [5], starts_at: null, ends_at: "2026-12-01T10:00", is_active: true });
  });
});

describe("CouponDrawer", () => {
  function wrap(ui: React.ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <TooltipProvider>{ui}</TooltipProvider>
      </QueryClientProvider>,
    );
  }

  it("asks for the code, then sends a free-shipping coupon in capitals", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    wrap(<CouponDrawer state={{ mode: "create" }} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    expect((await screen.findAllByText(ar.validation.required)).length).toBeGreaterThan(0);

    await user.type(document.getElementById("coupon-code")!, "ship free");
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(ar.promotions.coupons.types.free_shipping.title) }));
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(String(post[0])).toBe("/api/bff/dashboard/discount-codes");
    expect(JSON.parse(post[1].body)).toMatchObject({ code: "SHIPFREE", type: "free_shipping", value: null, applies_to: "all", product_ids: [], first_order_only: false, stackable_with_offers: true });
  });
});
