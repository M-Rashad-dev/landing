import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/messages/ar";
import { PayView, type PayInfo } from "./pay-view";
import { defaultPayment, hasPaymentChoice, PaymentChoice } from "./payment-choice";

vi.mock("@/lib/media/compress", () => ({ ImageRejected: class extends Error {}, prepareImage: async (f: File) => new File([f], "receipt.webp", { type: "image/webp" }) }));

const t = ar.storefront.pay;
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const info: PayInfo = {
  order_number: 1042,
  total: 350,
  status: "awaiting",
  payment_status: "unpaid",
  chosen_method_id: 2,
  methods: [
    { id: 1, kind: "instapay", name: "إنستاباي", account: null, link: "https://ipn.eg/S/habba", instructions: null },
    { id: 2, kind: "wallet", name: "فودافون كاش", account: "01012345678", link: null, instructions: "اكتب رقم الطلب" },
  ],
  receipts: [],
  can_send: true,
  cancel_at: "2026-11-25T10:00:00Z",
  store: { brand_name: "متجر حبة", colors: { primary: "#0b7a55" }, logo: null },
  track_url: "https://mksab.store/t/abcdefabcdef",
};

describe("the pay page", () => {
  it("pays online on the store's gateway: no receipt, straight to its page", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, search: "", pathname: "/pay/abcdefabcdef", assign });
    const online = { ...info, chosen_method_id: 3, methods: [{ id: 3, kind: "online" as const, gateway: "paymob", name: "ادفع أونلاين", account: null, link: null, instructions: null }, ...info.methods] };
    fetchMock.mockResolvedValueOnce(Response.json({ data: online })).mockResolvedValueOnce(Response.json({ data: { url: "https://eg.checkout.paymob.com/?publicKey=x&clientSecret=y" } }));
    render(<PayView token="abcdefabcdef" />);

    fireEvent.click(await screen.findByRole("button", { name: t.payOnlineNow("350 ج.م") }));
    expect(document.querySelector('input[type="file"]')).toBeNull();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://eg.checkout.paymob.com/?publicKey=x&clientSecret=y"));
    expect(String(fetchMock.mock.calls[1][0])).toBe("/api/public/payments/online");
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual({ token: "abcdefabcdef", method_id: 3 });
  });

  it("asks the server to settle the checkout when back from the gateway", async () => {
    const replaceState = vi.fn();
    vi.stubGlobal("location", { ...window.location, search: "?ref=MK1O1042XABCDEF", pathname: "/pay/abcdefabcdef" });
    vi.stubGlobal("history", { ...window.history, replaceState });
    fetchMock.mockResolvedValueOnce(Response.json({ data: { ...info, status: "paid", payment_status: "paid", methods: [], can_send: false } }));
    render(<PayView token="abcdefabcdef" />);

    expect(await screen.findByText(t.paidTitle)).toBeInTheDocument();
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({ token: "abcdefabcdef", ref: "MK1O1042XABCDEF" });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/pay/abcdefabcdef");
  });

  it("shows the total and the chosen way to pay, and sends the receipt", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: info }));
    render(<PayView token="abcdefabcdef" />);

    expect(await screen.findByText(t.order(1042))).toBeInTheDocument();
    expect(screen.getByText("01012345678")).toBeInTheDocument();
    expect(screen.getByText("اكتب رقم الطلب")).toBeInTheDocument();
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({ token: "abcdefabcdef" });

    fireEvent.click(screen.getByRole("radio", { name: /إنستاباي/ }));
    expect(screen.getByRole("link", { name: t.openLink })).toHaveAttribute("href", "https://ipn.eg/S/habba");
    fireEvent.click(screen.getByRole("radio", { name: /فودافون كاش/ }));

    fireEvent.click(screen.getByRole("button", { name: t.send }));
    expect(await screen.findByText(t.receiptRequired)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/الرقم أو الاسم/), { target: { value: "01099998888" } });
    fireEvent.change(screen.getByLabelText(t.receipt), { target: { files: [new File([new Uint8Array(10)], "r.png", { type: "image/png" })] } });
    expect(await screen.findByText("receipt.webp")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(Response.json({ data: { ...info, payment_status: "review", can_send: false, receipts: [{ status: "pending", method: "فودافون كاش", reject_reason: null, created_at: "2026-11-22T10:00:00Z" }] } }, { status: 201 }));
    fireEvent.click(screen.getByRole("button", { name: t.send }));

    expect(await screen.findByText(t.reviewTitle)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/public/payments");
    const body = init.body as FormData;
    expect(body.get("method_id")).toBe("2");
    expect(body.get("sender_ref")).toBe("01099998888");
    expect(body.get("token")).toBe("abcdefabcdef");
    expect(screen.queryByRole("button", { name: t.send })).not.toBeInTheDocument();
  });

  it("says why a receipt was refused, and when the order is paid or not found", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { ...info, receipts: [{ status: "rejected", method: "فودافون كاش", reject_reason: "المبلغ ناقص", created_at: "2026-11-22T10:00:00Z" }] } }));
    render(<PayView token="abcdefabcdef" />);
    expect(await screen.findByText(t.rejectedText("المبلغ ناقص"))).toBeInTheDocument();
    cleanup();

    fetchMock.mockResolvedValueOnce(Response.json({ data: { ...info, status: "paid", can_send: false, methods: [] } }));
    render(<PayView token="abcdefabcdef" />);
    expect(await screen.findByText(t.paidTitle)).toBeInTheDocument();
    cleanup();

    fetchMock.mockResolvedValueOnce(Response.json({ code: "order_not_found" }, { status: 404 }));
    render(<PayView token="abcdefabcdef" />);
    expect(await screen.findByText(t.notFound)).toBeInTheDocument();
  });
});

describe("the payment choice at checkout", () => {
  it("starts on cash on delivery when it is on, else the first method", () => {
    const methods = [{ id: 7, kind: "wallet" as const, name: "فودافون كاش" }];
    expect(defaultPayment(undefined)).toBe("cod");
    expect(defaultPayment({ cod: true, methods })).toBe("cod");
    expect(defaultPayment({ cod: false, methods })).toBe("7");
    expect(hasPaymentChoice({ cod: true, methods: [] })).toBe(false);
    expect(hasPaymentChoice({ cod: false, methods })).toBe(true);
  });

  it("lists cash on delivery and the methods", async () => {
    const onChange = vi.fn();
    render(<PaymentChoice options={{ cod: true, methods: [{ id: 7, kind: "wallet", name: "فودافون كاش" }] }} value="cod" onChange={onChange} error="اختار طريقة الدفع." />);
    expect(screen.getByRole("radio", { name: new RegExp(ar.storefront.payment.cod) })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /فودافون كاش/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("7"));
    expect(screen.getByText("اختار طريقة الدفع.")).toBeInTheDocument();
  });
});
