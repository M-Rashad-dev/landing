import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { BidayaPage } from "./page";
import type { Content, LandingData } from "./types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/watch", useSearchParams: () => new URLSearchParams() }));

const fields = { name: { enabled: true, required: true }, phone: { enabled: true, required: true }, phone2: { enabled: false, required: false }, email: { enabled: false, required: false }, governorate: { enabled: true, required: true }, city: { enabled: false, required: false }, address: { enabled: true, required: true }, notes: { enabled: false, required: false } };

export const content: Content = {
  version: 1,
  settings: {
    colors: { primary: "#0b875b", secondary: "#ffc83d", background: "#ffffff", text: "#13261d" },
    font: "cairo",
    font_size: "medium",
    button: "pill",
    logo_media_id: null,
    header: { show: true, announcement: "شحن مجاني النهارده" },
    footer: { text: null, phone: null, whatsapp: null, social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null } },
    general: { sticky_order_button: true, whatsapp_button: false },
  },
  sections: [
    { id: "hero000001", type: "hero", visible: true, props: { title: "ساعتك الذكية", subtitle: "الدفع عند الاستلام", image_media_id: null, show_price: true, button_label: "اطلب دلوقتي", badge: "خصم 30%" } },
    { id: "faq0000001", type: "faq", visible: true, props: { title: "أسئلة", items: [{ question: "الدفع إزاي؟", answer: "كاش." }] } },
    { id: "test000001", type: "testimonials", visible: true, props: { title: "آراء", source: "auto", items: [] } },
    { id: "form000001", type: "order_form", visible: true, props: { title: "اطلب دلوقتي", subtitle: null, button_label: "تأكيد الطلب", fields, offer_picker: true, show_quantity: true } },
  ],
};

export const data: LandingData = {
  page: { id: 5, slug: "watch", title: "عرض الساعة" },
  store_name: "متجر سما",
  product: { id: 1, name: "ساعة ذكية", slug: "watch", description: null, short_description: null, price: 850, compare_at_price: 1200, available: true, stock_mode: "unlimited", stock: null, variant_stock: null, images: [], options: [] },
  offers: [{ id: 3, name: "اشترِ 2", type: "bundle", value: null, min_quantity: null, free_quantity: null, required_quantity: 2, gift: null, bundle_quantity: 2, bundle_price: 1500, starts_at: null, ends_at: null, status: "active", badge_text: null, priority: 1 }],
  media: {},
  reviews: [],
  shipping: { enabled: false },
};

let calls: Array<{ url: string; body: unknown }>;

beforeEach(() => {
  calls = [];
  push.mockReset();
  window.sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, body });
      if (url.startsWith("/api/public/landing/form-token")) return Response.json({ data: { token: "tok" } });
      if (url === "/api/public/landing/quote") return Response.json({ data: { unit_price: 850, quantity: body.quantity, base_subtotal: 850 * body.quantity, offer: null, subtotal_after_offer: 850 * body.quantity, code: null, code_error: null, shipping: null, total: 850 * body.quantity } });
      if (url === "/api/public/landing/orders") return Response.json({ data: { order_number: 1001, total: 1500 } }, { status: 201 });
      return new Response(null, { status: 202 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("«بداية»", () => {
  it("draws the page: announcement, hero with the price after the old one, and the order form", () => {
    render(<BidayaPage content={content} data={data} mode="live" />);
    expect(screen.getByText("شحن مجاني النهارده")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ساعتك الذكية" })).toBeInTheDocument();
    expect(screen.getAllByText(formatMoney(850)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatMoney(1200)).length).toBeGreaterThan(0);
    // Automatic reviews with none yet: hidden on the live page.
    expect(screen.queryByText("آراء")).toBeNull();
    expect(screen.getByRole("heading", { name: "اطلب دلوقتي" })).toBeInTheDocument();
  });

  it("checks the fields, then sends the order with the chosen offer and goes to «طلبك وصل»", async () => {
    render(<BidayaPage content={content} data={data} mode="live" />);
    const c = ar.storefront.checkout;
    fireEvent.click(screen.getByRole("button", { name: /تأكيد الطلب/ }));
    expect(await screen.findByText(c.errors.name)).toBeInTheDocument();
    expect(screen.getByText(c.errors.phone)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /اشترِ 2/ }));
    fireEvent.change(screen.getByLabelText(c.name), { target: { value: "أحمد علي" } });
    fireEvent.change(screen.getByLabelText(c.phone), { target: { value: "01012345678" } });
    fireEvent.change(screen.getByLabelText(c.governorate), { target: { value: "القاهرة" } });
    fireEvent.change(screen.getByLabelText(c.address), { target: { value: "شارع 9" } });
    await waitFor(() => expect(calls.some((x) => x.url.startsWith("/api/public/landing/form-token"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /تأكيد الطلب/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/watch/done?order=1001"));
    const order = calls.find((x) => x.url === "/api/public/landing/orders")!.body as Record<string, unknown>;
    expect(order).toMatchObject({ slug: "watch", quantity: 2, offer_id: 3, form_token: "tok", customer: { name: "أحمد علي", phone: "+201012345678", governorate: "القاهرة", address: "شارع 9" } });
    expect(JSON.parse(window.sessionStorage.getItem("bd_placed")!)).toMatchObject({ number: 1001, total: 1500 });
  });

  it("sends nothing from the Builder", async () => {
    render(<BidayaPage content={content} data={data} mode="builder" />);
    fireEvent.change(screen.getByLabelText(ar.storefront.checkout.name), { target: { value: "أحمد علي" } });
    fireEvent.change(screen.getByLabelText(ar.storefront.checkout.phone), { target: { value: "01012345678" } });
    fireEvent.change(screen.getByLabelText(ar.storefront.checkout.governorate), { target: { value: "القاهرة" } });
    fireEvent.change(screen.getByLabelText(ar.storefront.checkout.address), { target: { value: "شارع 9" } });
    fireEvent.click(screen.getByRole("button", { name: /تأكيد الطلب/ }));
    expect(await screen.findByText(ar.bidaya.form.preview)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
