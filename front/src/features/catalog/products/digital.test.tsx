import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { DeliveriesCard } from "@/features/orders/deliveries-card";
import type { OrderDetail } from "@/features/orders/api";
import { ar } from "@/messages/ar";
import { PayView, type PayInfo } from "@/themes/shared/pay-view";
import { DigitalEditor } from "./digital-editor";
import { EMPTY, fromDetail, toPayload, type ProductValues } from "./form-model";
import type { ProductDetail } from "./api";

vi.mock("@/lib/media/compress", () => ({ ImageRejected: class extends Error {}, prepareImage: async (f: File) => f }));

const t = ar.catalog.form.digital;
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

function Editor({ product, start }: { product: ProductDetail | null; start?: Partial<ProductValues> }) {
  const form = useForm<ProductValues>({ defaultValues: { ...EMPTY, ...start } });
  return (
    <FormProvider {...form}>
      <DigitalEditor product={product} />
    </FormProvider>
  );
}

describe("a digital product in the product form", () => {
  it("sends its delivery type and settings, and never stock", () => {
    const body = toPayload({ ...EMPTY, name: "كورس", price: "200", kind: "digital", delivery_type: "links", link: " https://videos.test/c ", opens: "3", subject: "", message: "أهلاً {name}", stock_mode: "product", stock: "5" });
    expect(body).toMatchObject({ kind: "digital", delivery_type: "links", delivery_settings: { downloads: null, link: "https://videos.test/c", opens: 3, subject: null, message: "أهلاً {name}" }, stock_mode: "unlimited", stock: null });
    expect(toPayload({ ...EMPTY, name: "تيشيرت", price: "100" })).toMatchObject({ kind: "physical", delivery_type: null, delivery_settings: null });

    const values = fromDetail({ ...({} as ProductDetail), name: "كتاب", price: 50, options: [], inputs: [], variants: [], media: [], category_ids: [], kind: "digital", delivery_type: "files", delivery_settings: { downloads: 2 } } as ProductDetail);
    expect(values).toMatchObject({ kind: "digital", delivery_type: "files", downloads: "2", link: "" });
  });

  it("asks to save first, then manages the codes (pasted one per line)", async () => {
    const { unmount } = wrap(<Editor product={null} start={{ kind: "digital", delivery_type: "codes" }} />);
    expect(screen.getByText(t.saveFirst)).toBeInTheDocument();
    unmount();

    fetchMock.mockResolvedValueOnce(Response.json({ data: { combinations: [{ key: "", label: "", left: 0, count: 0 }], codes: [] } }));
    wrap(<Editor product={{ id: 7 } as ProductDetail} start={{ kind: "digital", delivery_type: "codes" }} />);
    expect(await screen.findByText(t.noCodes)).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(Response.json({ data: { combinations: [{ key: "", label: "", left: 2, count: 2 }], codes: [{ id: 1, code: "AAA", uses_total: 1, uses_left: 1 }, { id: 2, code: "BBB", uses_total: 1, uses_left: 1 }] } }, { status: 201 }));
    fireEvent.change(screen.getByLabelText(new RegExp(t.addCodes)), { target: { value: "AAA\n\nBBB\n" } });
    fireEvent.click(screen.getByRole("button", { name: t.addCount(2) }));

    expect(await screen.findByText("BBB")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/bff/dashboard/products/7/codes");
    expect(JSON.parse(String(init.body))).toEqual({ combination_key: "", codes: [{ code: "AAA", uses: 1 }, { code: "BBB", uses: 1 }] });
    expect(screen.getByText(t.codesLeft(2))).toBeInTheDocument();
  });
});

describe("the buyer's products", () => {
  it("lists downloads, codes and the link once paid", async () => {
    const info = {
      order_number: 5,
      total: 100,
      status: "paid",
      payment_status: "paid",
      chosen_method_id: null,
      methods: [],
      receipts: [],
      can_send: false,
      cancel_at: null,
      store: null,
      track_url: "https://mksab.store/t/abcdefabcdef",
      deliveries: [
        { product: "كتاب", type: "files", status: "delivered", message: "حمّل كتابك", files: [{ id: 3, name: "الكتاب", size: 10, left: 0, url: "https://s.test/api/public/downloads/t/3" }], codes: [], link: null },
        { product: "شدات", type: "codes", status: "delivered", message: null, files: [], codes: ["UC-1234"], link: null },
        { product: "خدمة", type: "services", status: "pending", message: null, files: [], codes: [], link: null },
      ],
    } as PayInfo;
    fetchMock.mockResolvedValueOnce(Response.json({ data: info }));
    render(<PayView token="abcdefabcdef" />);

    expect(await screen.findByText(ar.storefront.pay.yourProducts)).toBeInTheDocument();
    expect(screen.getByText("حمّل كتابك")).toBeInTheDocument();
    expect(screen.getByText(ar.storefront.pay.usedUp)).toBeInTheDocument();
    expect(screen.getByText("UC-1234")).toBeInTheDocument();
    expect(screen.getByText(ar.storefront.pay.serviceWaiting)).toBeInTheDocument();
  });
});

describe("the order's digital lines", () => {
  it("finishes a service with the merchant's message", async () => {
    const order = {
      id: 9,
      order_number: 1050,
      customer_name: "سارة",
      items: [{ id: 4, product_name: "متابعين", delivery_type: "services" }],
      deliveries: [{ id: 2, order_item_id: 4, type: "services", status: "pending", codes: [], link: null, subject: null, message: null, limit: null, bonus: 0, usage: {}, files: [], default_subject: null, default_message: "اتضاف المتابعين يا {name}.", delivered_at: null, emailed_at: null }],
    } as unknown as OrderDetail;
    const onSaved = vi.fn(async () => undefined);
    wrap(<DeliveriesCard order={order} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(ar.orders.deliveries.complete) }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(ar.orders.deliveries.message)).toHaveValue("اتضاف المتابعين يا سارة.");

    fetchMock.mockResolvedValueOnce(Response.json({ data: { status: "delivered" } }));
    fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(ar.orders.deliveries.send) }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/bff/dashboard/orders/9/deliveries/2/complete");
    expect(JSON.parse(String(init.body))).toEqual({ subject: "طلبك رقم 1050 اتنفذ", message: "اتضاف المتابعين يا سارة." });
  });
});
