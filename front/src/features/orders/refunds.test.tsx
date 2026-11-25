import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { SessionProvider } from "@/lib/auth/session-context";
import { ar } from "@/messages/ar";
import type { OrderDetail, Refund } from "./api";
import { suggestedAmount } from "./refund-dialog";
import { RefundsCard } from "./refunds-card";
import { StatusDialog } from "./status-dialog";

const r = ar.refunds;
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const pending: Refund = {
  id: 7, order_id: 5, order_number: 1001, customer_name: "سارة", amount: 200, items: [{ order_item_id: 11, product_name: "قميص", quantity: 1 }], reason: "مقاس غلط",
  method: "wallet", method_label: "محفظة", destination: "01099998888", reference: null, has_proof: false, proof_is_pdf: false, status: "pending",
  restock: true, restocked: false, revoke_digital: false, created_by: "م", done_by: null, done_at: null, cancelled_at: null, created_at: "2026-11-24T10:00:00Z",
};

function order(extra: Partial<OrderDetail["refunds"]> = {}): OrderDetail {
  return {
    id: 5,
    order_number: 1001,
    status: "delivered",
    items: [
      { id: 11, product_id: 1, product_name: "قميص", is_upsell: false, is_gift: false, delivery_type: null, unit_price: 200, quantity: 3, options: [], offer_name: null, offer_discount: 0, line_total: 600 },
      { id: 12, product_id: 2, product_name: "كورس", is_upsell: false, is_gift: false, delivery_type: "files", unit_price: 50, quantity: 1, options: [], offer_name: null, offer_discount: 0, line_total: 50 },
    ],
    refunds: { collected: 700, refundable: 700, refunded: 0, state: null, method_name: "كاش (الدفع عند الاستلام)", default_destination: "+201012345678", items_left: { "11": 3, "12": 1 }, list: [], ...extra },
  } as unknown as OrderDetail;
}

function wrap(ui: React.ReactNode, permissions: string[] = ["*"]) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <SessionProvider value={{ user: { id: 1, name: "م", role: "owner", permissions }, tenant: { name: "x" }, plan: null, store_name: "x", storeUrl: null } as never}>{ui}</SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

const sent = (path: string) => fetchMock.mock.calls.find(([url]) => String(url).includes(path));

describe("refunds", () => {
  it("suggests the amount of the chosen lines, never above what can go back", () => {
    expect(suggestedAmount(order(), "all", {})).toBe(700);
    expect(suggestedAmount(order(), "items", { "11": 2 })).toBe(400);
    expect(suggestedAmount(order({ refundable: 300 }), "items", { "11": 2 })).toBe(300);
    expect(suggestedAmount(order(), "amount", {})).toBe(0);
  });

  it("shows what came in and went back, and hides «رد مبلغ» without the permission", () => {
    wrap(<RefundsCard order={order({ refunded: 200, refundable: 500, list: [pending] })} onSaved={async () => undefined} />, ["orders.view"]);
    expect(screen.getByText(r.card.title)).toBeInTheDocument();
    expect(screen.getByText(r.card.collected)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: r.card.add })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: r.card.complete })).not.toBeInTheDocument();
    expect(screen.getByText("مقاس غلط")).toBeInTheDocument();
  });

  it("says nothing when no money came in", () => {
    const { container } = wrap(<RefundsCard order={order({ collected: 0, refundable: 0 })} onSaved={async () => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("refunds chosen lines with their suggested amount, back to stock", async () => {
    const onSaved = vi.fn(async () => undefined);
    fetchMock.mockResolvedValue(Response.json({ data: pending }, { status: 201 }));
    wrap(<RefundsCard order={order()} onSaved={onSaved} />);
    await userEvent.click(screen.getByRole("button", { name: r.card.add }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("radio", { name: r.dialog.items }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "قميص" }));
    expect(within(dialog).getByLabelText(new RegExp(r.dialog.amount))).toHaveValue("600");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: r.dialog.restock }));
    await userEvent.click(within(dialog).getByRole("button", { name: r.dialog.submit }));

    await waitFor(() => expect(sent("/dashboard/orders/5/refunds")).toBeTruthy());
    expect(JSON.parse(String((sent("/dashboard/orders/5/refunds")![1] as RequestInit).body))).toEqual({
      amount: "600", method: "original", items: [{ order_item_id: 11, quantity: 3 }], destination: "+201012345678", restock: true, revoke_digital: false, done: false,
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("sends the money back through the gateway the order was paid with, right away", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: { ...pending, method: "gateway", status: "done" } }, { status: 201 }));
    wrap(<RefundsCard order={order({ gateway: { key: "paymob", label: "Paymob" } })} onSaved={async () => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: r.card.add }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(r.dialog.gatewayHint("Paymob"))).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(new RegExp(r.dialog.destination))).not.toBeInTheDocument();
    expect(within(dialog).queryByText(r.dialog.alreadySent)).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: r.dialog.submitGateway }));

    await waitFor(() => expect(sent("/dashboard/orders/5/refunds")).toBeTruthy());
    expect(JSON.parse(String((sent("/dashboard/orders/5/refunds")![1] as RequestInit).body))).toMatchObject({ amount: "700", method: "gateway", done: true });
  });

  it("refuses an amount above what can go back", async () => {
    wrap(<RefundsCard order={order({ refundable: 100 })} onSaved={async () => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: r.card.add }));
    const dialog = await screen.findByRole("dialog");
    const amount = within(dialog).getByLabelText(new RegExp(r.dialog.amount));
    await userEvent.clear(amount);
    await userEvent.type(amount, "150");
    await userEvent.click(within(dialog).getByRole("button", { name: r.dialog.submit }));
    expect(await within(dialog).findByText(r.dialog.amountMax("100 ج.م"), { exact: false })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("completes a pending refund with its reference", async () => {
    const onSaved = vi.fn(async () => undefined);
    fetchMock.mockResolvedValue(Response.json({ data: { ...pending, status: "done" } }));
    wrap(<RefundsCard order={order({ refundable: 500, list: [pending] })} onSaved={onSaved} />);
    await userEvent.click(screen.getByRole("button", { name: r.card.complete }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(new RegExp(r.dialog.reference)), "TX-1");
    await userEvent.click(within(dialog).getByRole("button", { name: r.complete.submit }));
    await waitFor(() => expect(sent("/dashboard/refunds/7/complete")).toBeTruthy());
    const body = (sent("/dashboard/refunds/7/complete")![1] as RequestInit).body as FormData;
    expect(body.get("reference")).toBe("TX-1");
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("asks «هترجّع الفلوس؟» when cancelling a paid order and records the refund", async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).includes("/refunds") ? Response.json({ data: pending }, { status: 201 }) : Response.json({ data: order() })));
    const onDone = vi.fn();
    wrap(<StatusDialog open onOpenChange={() => undefined} targets={["returned", "damaged"]} ids={[5]} refundable={700} onDone={onDone} />);
    expect(await screen.findByText(r.status_question.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ar.common.confirm }));
    await waitFor(() => expect(sent("/dashboard/orders/5/refunds")).toBeTruthy());
    expect(JSON.parse(String((sent("/dashboard/orders/5/refunds")![1] as RequestInit).body))).toMatchObject({ amount: "700", method: "original" });
    expect(onDone).toHaveBeenCalled();
  });

  it("does not ask when nothing came in", async () => {
    wrap(<StatusDialog open onOpenChange={() => undefined} targets={["cancelled"]} ids={[5]} onDone={() => undefined} />);
    expect(screen.queryByText(r.status_question.title)).not.toBeInTheDocument();
  });
});
