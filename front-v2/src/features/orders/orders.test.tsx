import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/messages/ar";
import { NEXT, orderQuery, TAB_STATUSES, whatsappLink, type OrderFilters } from "./api";
import { confirmMessage } from "./order-quick-view";
import { StatusDialog } from "./status-dialog";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ data: { id: 5, status: "shipped" } }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const base: OrderFilters = { tab: "all", q: "", from: "", to: "", governorate: "", source: "", company: "", duplicate: false, sort: "latest", page: 1 };

describe("order filters", () => {
  it("sends returned and damaged together for the returned tab, and leaves empty filters out", () => {
    expect(TAB_STATUSES.returned).toEqual(["returned", "damaged"]);
    expect(orderQuery({ ...base, tab: "returned", governorate: "أسوان", duplicate: true })).toMatchObject({ status: "returned,damaged", governorate: "أسوان", duplicate: 1, sort: null });
    expect(orderQuery({ ...base, tab: "new" }, false).status).toBeNull();
  });

  it("follows the back end transition table", () => {
    expect(NEXT.confirmed).toContain("shipped");
    expect(NEXT.shipped).toEqual(["delivered", "returned", "damaged", "cancelled"]);
    expect(NEXT.returned).toEqual([]);
  });
});

describe("WhatsApp", () => {
  it("asks the customer to confirm with the items and total", () => {
    const text = confirmMessage(
      {
        customer_name: "سارة محمد",
        order_number: 1042,
        total: 850,
        items: [
          { id: 1, product_id: 1, product_name: "ساعة", is_upsell: false, is_gift: false, unit_price: 425, quantity: 2, options: [], offer_name: null, offer_discount: 0, line_total: 850 },
          { id: 2, product_id: 2, product_name: "شراب", is_upsell: false, is_gift: true, unit_price: 0, quantity: 1, options: [], offer_name: null, offer_discount: 0, line_total: 0 },
        ],
      },
      "متجر نعناع",
    );
    expect(text).toBe(ar.orders.whatsappConfirm("سارة", "متجر نعناع", 1042, "2 × ساعة", 850));
    expect(whatsappLink("+201012345678", "أهلًا")).toBe(`https://wa.me/201012345678?text=${encodeURIComponent("أهلًا")}`);
  });
});

describe("StatusDialog", () => {
  it("ships one order with a tracking number and a note", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<StatusDialog open onOpenChange={() => undefined} targets={["shipped", "delivered", "cancelled"]} ids={[5]} onDone={onDone} />);

    await user.type(screen.getByLabelText(new RegExp(ar.orders.status.tracking)), "BOS-1");
    await user.type(screen.getByLabelText(new RegExp(ar.orders.status.note)), "مع بوسطة");
    fireEvent.click(screen.getByRole("button", { name: ar.common.confirm }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/bff/dashboard/orders/5/status");
    expect(JSON.parse(init.body)).toEqual({ status: "shipped", note: "مع بوسطة", tracking_number: "BOS-1" });
  });

  it("changes several orders at once without the single-order extras", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: { succeeded: 2, failed: 0, results: [] } }));
    const onDone = vi.fn();
    render(<StatusDialog open onOpenChange={() => undefined} targets={["delivered"]} ids={[1, 2]} onDone={onDone} />);
    expect(screen.queryByLabelText(new RegExp(ar.orders.status.tracking))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: ar.common.confirm }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ids: [1, 2], status: "delivered" });
  });
});
