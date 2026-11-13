import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import { MethodsPage } from "./methods-page";
import type { PaymentMethod, PaymentRow, RefundRow } from "./payments-api";
import { PaymentsPage } from "./payments-page";
import { RefundsPage } from "./refunds-page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }), usePathname: () => "/admin/payments", useSearchParams: () => new URLSearchParams() }));

const t = ar.admin;
const d = t.payments.dialog;

const payment = (id: number, store: string, extra: Partial<PaymentRow> = {}): PaymentRow => ({
  id,
  status: "pending_review",
  tenant: { id: id + 100, name: store, reference: `ST-00${id}` },
  method: { key: "instapay", name: "إنستاباي" },
  amount: 299,
  sender_ref: `TX-${id}`,
  reject_reason: null,
  created_at: "2026-11-12T10:00:00Z",
  reviewed_at: null,
  repeated_ref: false,
  invoice: { id, number: `INV-00000${id}`, status: "pending_review", type: "subscription", plan_name: "برو", period: "monthly", total: 299, starts_now: true },
  ...extra,
});

let payments: PaymentRow[];
let refunds: RefundRow[];
let methods: PaymentMethod[];
let calls: Array<{ url: string; method: string; body: unknown }>;

beforeEach(() => {
  calls = [];
  replace.mockReset();
  payments = [payment(1, "متجر سما", { repeated_ref: true }), payment(2, "متجر نور")];
  refunds = [{ id: 9, number: "INV-000009", tenant: { id: 5, name: "متجر هنا" }, plan_name: "برو", total: 299, status: "paid", refund_requested_at: "2026-11-12T10:00:00Z", refund_reason: "مش محتاجها", refunded_at: null, refund_ref: null }];
  methods = [{ key: "vodafone_cash", name: "فودافون كاش", kind: "manual", account_label: "رقم المحفظة", account_value: null, instructions: null, is_active: false, sort_order: 2 }];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, method, body });
      const path = url.replace(/^\/api\/bff/, "").split("?")[0];
      const pending = payments.filter((p) => p.status === "pending_review");
      if (path === "/admin/payments")
        return Response.json({ data: pending, meta: { current_page: 1, last_page: 1, per_page: 25, total: pending.length, pending: pending.length, counts: { pending_review: pending.length, approved: 0, rejected: 0, all: payments.length } } });
      const decided = path.match(/^\/admin\/payments\/(\d+)\/(approve|reject)$/);
      if (decided) {
        const row = payments.find((p) => p.id === Number(decided[1]))!;
        row.status = decided[2] === "approve" ? "approved" : "rejected";
        return Response.json({ data: row });
      }
      if (path === "/admin/payment-methods") return Response.json({ data: methods });
      if (path.startsWith("/admin/payment-methods/")) return Response.json({ data: { ...methods[0], ...body } });
      if (path === "/admin/refunds") return Response.json({ data: refunds });
      if (path === "/admin/invoices/9/refund") {
        refunds = [{ ...refunds[0], status: "refunded", refund_ref: body.refund_ref, refunded_at: "2026-11-13T10:00:00Z" }];
        return Response.json({ data: refunds });
      }
      if (path === "/admin/overview" || path.startsWith("/admin/tenants")) return Response.json({ data: {} });
      return Response.json({ message: "not found" }, { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );

describe("admin payments", () => {
  it("reviews the queue: warns about a repeated number, approves, then rejects the next with a reason", async () => {
    wrap(<PaymentsPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: t.payments.review }))[0]);

    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(d.title("INV-000001"))).toBeInTheDocument();
    expect(within(dialog).getByText(t.payments.repeatedText)).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: d.receipt })).toHaveAttribute("src", "/api/bff/admin/payments/1/receipt");

    fireEvent.click(within(dialog).getByRole("button", { name: d.approve }));
    expect(within(dialog).getByText(d.approveTitle)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: d.approve }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/admin/payments/1/approve") && c.method === "POST")).toBe(true));

    // The next receipt opens by itself.
    dialog = await screen.findByRole("dialog", { name: d.title("INV-000002") });
    fireEvent.click(within(dialog).getByRole("button", { name: d.reject }));
    fireEvent.click(within(dialog).getByRole("button", { name: d.reject }));
    expect(await within(dialog).findByText(d.reasonRequired)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: d.quickReasons[0] }));
    fireEvent.click(within(dialog).getByRole("button", { name: d.reject }));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/admin/payments/2/reject"))?.body).toEqual({ reason: d.quickReasons[0] }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("admin refunds", () => {
  it("records a refund with its transfer number", async () => {
    wrap(<RefundsPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: t.refunds.complete }))[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: t.refunds.confirm }));
    expect(await within(dialog).findByText(t.refunds.refundRefRequired)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(new RegExp(t.refunds.refundRef)), { target: { value: "IP-55443322" } });
    fireEvent.click(within(dialog).getByRole("button", { name: t.refunds.confirm }));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/admin/invoices/9/refund"))?.body).toEqual({ refund_ref: "IP-55443322" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("admin payment methods", () => {
  it("needs the account before a method is turned on", async () => {
    wrap(<MethodsPage />);
    fireEvent.click(await screen.findByRole("switch", { name: new RegExp(t.methods.active) }));
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    expect(await screen.findByText(t.methods.accountRequired)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(new RegExp(t.methods.accountValue)), { target: { value: "01012345678" } });
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({ is_active: true, account_value: "01012345678", name: "فودافون كاش", account_label: "رقم المحفظة", instructions: null }));
  });
});
