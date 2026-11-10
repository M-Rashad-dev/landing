import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import type { Invoice } from "@/lib/billing/payments";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";
import { InvoiceView } from "./invoice-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

const t = ar.billing.invoices;

const open: Invoice = {
  id: 7,
  number: "INV-000007",
  status: "open",
  type: "subscription",
  plan: { key: "pro", name: "برو" },
  theme: null,
  period: "monthly",
  days: 30,
  starts_now: true,
  subtotal: 100,
  discount: 0,
  credit: 0,
  total: 100,
  currency: "EGP",
  payable: true,
  expires_at: "2026-11-13T10:00:00Z",
  paid_at: null,
  created_at: "2026-11-11T10:00:00Z",
  refund_requested_at: null,
  refund_reason: null,
  refunded_at: null,
  payments: [],
  pay_with: [
    { key: "instapay", name: "إنستاباي", kind: "manual", type: "transfer", amount: 100, account_label: "عنوان الدفع", account_value: "platform@instapay", instructions: "حوّل المبلغ", reference: "INV-000007" },
  ],
};

const fetchMock = vi.fn();
const json = (data: unknown, status = 200, meta: unknown = { support: { email: "help@x.test", whatsapp: null } }) =>
  Promise.resolve(new Response(JSON.stringify({ data, meta }), { status, headers: { "Content-Type": "application/json" } }));

function renderView() {
  return render(
    <Providers>
      <InvoiceView id={7} />
    </Providers>,
  );
}

describe("InvoiceView", () => {
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("shows where to transfer and sends the receipt as a file", async () => {
    let sent: FormData | null = null;
    const pending: Invoice = { ...open, status: "pending_review", payable: false, pay_with: [], payments: [{ id: 1, method: { key: "instapay", name: "إنستاباي" }, amount: 100, sender_ref: "TX-1", status: "pending_review", reject_reason: null, created_at: null, reviewed_at: null }] };
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/payments") && init?.method === "POST") {
        sent = init.body as FormData;
        return json(pending, 201);
      }
      return json(sent ? pending : open);
    });
    renderView();

    expect(await screen.findByText("platform@instapay")).toBeInTheDocument();
    expect(screen.getAllByText(formatPrice(100)).length).toBeGreaterThan(0);

    // Missing receipt: client-side validation, nothing sent.
    fireEvent.change(screen.getByLabelText(new RegExp(t.senderRef)), { target: { value: "TX-1" } });
    fireEvent.click(screen.getByRole("button", { name: t.send }));
    expect(await screen.findByText(ar.validation.required)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(false);

    const file = new File([new Uint8Array([1, 2, 3])], "r.png", { type: "image/png" });
    globalThis.URL.createObjectURL ??= () => "blob:preview";
    globalThis.URL.revokeObjectURL ??= () => undefined;
    fireEvent.change(document.getElementById("pay-receipt")!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: t.send }));

    expect(await screen.findByText(t.pendingTitle)).toBeInTheDocument();
    expect(sent).not.toBeNull();
    expect(sent!.get("method")).toBe("instapay");
    expect(sent!.get("sender_ref")).toBe("TX-1");
    expect((sent!.get("receipt") as File).name).toBe("r.png");
  });

  it("shows the reason of a rejected receipt and lets the merchant send another", async () => {
    fetchMock.mockImplementation(() =>
      json({ ...open, payments: [{ id: 1, method: { key: "instapay", name: "إنستاباي" }, amount: 100, sender_ref: "TX-1", status: "rejected", reject_reason: "المبلغ ناقص", created_at: null, reviewed_at: null }] }),
    );
    renderView();

    expect(await screen.findByText(t.rejectedReason("المبلغ ناقص"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.send })).toBeInTheDocument();
  });

  it("confirms a paid invoice", async () => {
    fetchMock.mockImplementation(() => json({ ...open, status: "paid", payable: false, pay_with: [], paid_at: "2026-11-11T12:00:00Z" }));
    renderView();

    expect(await screen.findByText(t.paidTitle)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: t.send })).toBeNull());
  });
});
