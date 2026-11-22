import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { PaymentCard } from "@/features/orders/payment-card";
import type { OrderDetail } from "@/features/orders/api";
import { ar } from "@/messages/ar";
import { PaymentsPage, type StorePayments } from "./payments-page";

const t = ar.settings.payments;
const p = ar.orders.payment;
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

const empty: StorePayments = { cod_enabled: true, cancel_after_days: 3, methods: [] };
const body = (i: number) => JSON.parse(String((fetchMock.mock.calls[i]?.[1] as RequestInit).body));

describe("«الدفع» settings", () => {
  it("keeps cash on delivery on until a prepaid method exists, and adds a wallet", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: empty }));
    wrap(<PaymentsPage />);

    expect(await screen.findByText(t.emptyTitle)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeDisabled();

    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(t.add) })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: new RegExp(t.kinds.wallet) }));
    expect(within(dialog).getByLabelText(new RegExp(t.name))).toHaveValue(t.kinds.wallet);
    fireEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));
    expect(await within(dialog).findByText(t.accountRequired)).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(Response.json({ data: { ...empty, methods: [{ id: 3, kind: "wallet", name: "فودافون كاش", account: "01012345678", link: null, instructions: null, is_active: true }] } }, { status: 201 }));
    fireEvent.change(within(dialog).getByLabelText(new RegExp(t.name)), { target: { value: "فودافون كاش" } });
    fireEvent.change(within(dialog).getByLabelText(new RegExp(t.account.wallet)), { target: { value: "01012345678" } });
    fireEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1][0])).toContain("/dashboard/payments/methods");
    expect(body(1)).toEqual({ kind: "wallet", name: "فودافون كاش", account: "01012345678", link: null, instructions: null, is_active: true });
    expect(await screen.findByText(/01012345678/)).toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toBeDisabled();
  });
});

const order = {
  id: 9,
  status: "awaiting_payment",
  payment: {
    method_name: "فودافون كاش",
    status: "review",
    paid_at: null,
    pay_url: "https://shop.test/pay/abcdefabcdef",
    receipts: [{ id: 4, method_name: "فودافون كاش", amount: 350, sender_ref: "01099998888", status: "pending", reject_reason: null, is_pdf: false, reviewer: null, reviewed_at: null, created_at: "2026-11-22T10:00:00Z" }],
  },
} as unknown as OrderDetail;

describe("the order's payment card", () => {
  it("accepts a receipt", async () => {
    const onSaved = vi.fn(async () => undefined);
    fetchMock.mockResolvedValueOnce(Response.json({ data: { status: "confirmed", payment_status: "paid" } }));
    wrap(<PaymentCard order={order} onSaved={onSaved} />);

    expect(screen.getByText(p.sender("01099998888"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(p.approve) }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/bff/dashboard/orders/9/payments/4/approve");
  });

  it("refuses a receipt only with a reason", async () => {
    const onSaved = vi.fn(async () => undefined);
    wrap(<PaymentCard order={order} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(p.reject) }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: p.reject }));
    expect(await within(dialog).findByText(p.reasonRequired)).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(Response.json({ data: { status: "awaiting_payment", payment_status: "unpaid" } }));
    fireEvent.change(within(dialog).getByLabelText(new RegExp(p.reasonLabel)), { target: { value: "المبلغ ناقص" } });
    fireEvent.click(within(dialog).getByRole("button", { name: p.reject }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(body(0)).toEqual({ reason: "المبلغ ناقص" });
  });
});
