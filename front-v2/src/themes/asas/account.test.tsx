import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addToCart } from "@/lib/store/cart";
import type { StoreConfig } from "@/lib/store/types";
import { ar } from "@/messages/ar";
import { AccountView, SignInView } from "./pages/account";
import { ProductReviewsSection } from "./pages/reviews";
import { CheckoutView } from "./pages/checkout";
import { AsasRoot } from "./root";
import type { Design, DesignData } from "./types";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const design = {
  settings: {
    colors: { primary: "#0b875b", secondary: "#ffc83d", background: "#ffffff", text: "#13261d" },
    font: "cairo",
    font_size: "medium",
    logo_media_id: null,
    favicon_media_id: null,
    header: { sticky: true, search: true, announcement: null },
    footer: { about: null, show_pages: true, phone: null, whatsapp: null, email: null, address: null, social: { facebook: null, instagram: null, tiktok: null, x: null, youtube: null, snapchat: null } },
    general: { whatsapp_button: false, show_out_of_stock: true, products_per_page: 24 },
  },
  sections: [],
} satisfies Design;
const data: DesignData = { products: {}, view_all: {}, links: {}, media: {}, categories: [], pages: [], reviews: [] };
const config = { theme_key: "asas", design, data, store_name: "نعناع", categories: [], pages: [], seo: { title: "", description: "", canonical: "https://x.com/", site_name: "" }, tracking: null, shipping: { enabled: false }, branding: true, primary_host: "x.com" } satisfies StoreConfig;

const inTheme = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AsasRoot settings={design.settings} data={data} storeName="نعناع" mode="live">
        {ui}
      </AsasRoot>
    </QueryClientProvider>,
  );

let calls: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = [];
function stub(routes: Record<string, () => Response>) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      const key = Object.keys(routes).find((k) => url.includes(k));
      return key ? routes[key]() : new Response(null, { status: 202 });
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  replace.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("sign in", () => {
  it("shows the code on screen while there is no SMS provider, then signs in and goes back", async () => {
    stub({
      "/account/code": () => Response.json({ data: { channel: "screen", expires_in: 300, resend_in: 60, code: "482913" } }),
      "/account/verify": () => Response.json({ data: { customer: { name: "سارة", phone: "+201012345678", addresses: [] } } }),
    });
    inTheme(<SignInView next="/checkout" />);

    fireEvent.change(screen.getByLabelText(ar.storefront.account.phone), { target: { value: "0101234" } });
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.account.sendCode }));
    expect(await screen.findByText(ar.storefront.checkout.errors.phone)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(ar.storefront.account.phone), { target: { value: "01012345678" } });
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.account.sendCode }));
    expect(await screen.findByTestId("screen-code")).toHaveTextContent("482913");
    expect(screen.getByText(ar.storefront.account.resendIn(60))).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(ar.storefront.account.code), { target: { value: "48 29 13" } });
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.account.verify }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/checkout"));
    expect(calls.find((c) => c.url.includes("/verify"))!.body).toEqual({ phone: "01012345678", code: "482913" });
  });

  it("never follows a next link out of the store", async () => {
    stub({
      "/account/code": () => Response.json({ data: { channel: "screen", expires_in: 300, resend_in: 60, code: "111111" } }),
      "/account/verify": () => Response.json({ data: { customer: { name: null, phone: "+201012345678", addresses: [] } } }),
    });
    inTheme(<SignInView next="//evil.com" />);
    fireEvent.change(screen.getByLabelText(ar.storefront.account.phone), { target: { value: "01012345678" } });
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.account.sendCode }));
    fireEvent.change(await screen.findByLabelText(ar.storefront.account.code), { target: { value: "111111" } });
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.account.verify }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/account"));
  });
});

describe("checkout signed in", () => {
  it("never replaces what the customer typed before the account arrived", async () => {
    addToCart({ product_id: 7, quantity: 1, options: {}, name: "قميص", slug: "shirt", image: null, price: 300, options_label: "" });
    let arrive: (r: Response) => void = () => undefined;
    const late = new Promise<Response>((resolve) => (arrive = resolve));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.includes("/store/account") ? late : url.includes("/form-token") ? Response.json({ data: { token: "tok" } }) : new Response(null, { status: 202 }))),
    );
    inTheme(<CheckoutView config={config} />);

    const name = await screen.findByLabelText(new RegExp(ar.storefront.checkout.name));
    fireEvent.change(name, { target: { value: "منى" } });
    arrive(Response.json({ data: { name: "سارة", phone: "+201012345678", addresses: [{ id: 4, name: "سارة", governorate: "الجيزة", city: null, address: "12 شارع الهرم", is_default: true }] } }));

    // The empty fields fill in; the typed name stays.
    expect(await screen.findByDisplayValue("12 شارع الهرم")).toBeInTheDocument();
    expect(name).toHaveValue("منى");
  });

  it("fills the details from the account, keeps the phone, and saves a new address", async () => {
    addToCart({ product_id: 7, quantity: 1, options: {}, name: "قميص", slug: "shirt", image: null, price: 300, options_label: "" });
    stub({
      "/store/account": () => Response.json({ data: { name: "سارة", phone: "+201012345678", addresses: [{ id: 4, name: "سارة", governorate: "الجيزة", city: null, address: "12 شارع الهرم", is_default: true }] } }),
      "/form-token": () => Response.json({ data: { token: "tok" } }),
      "/quote": () => Response.json({ data: { lines: [], items_count: 1, subtotal: 300, offer_discount: 0, code: null, code_discount: 0, code_error: null, shipping: null, shipping_original: null, shipping_free: false, shipping_available: true, shipping_company: null, shipping_offer: null, shipping_by_code: false, shipping_options: [], total: 300 } }),
      "/orders": () => Response.json({ data: { order_number: 77, total: 300 } }, { status: 201 }),
    });
    inTheme(<CheckoutView config={config} />);

    const phone = await screen.findByDisplayValue("01012345678");
    expect(phone).toHaveAttribute("readonly");
    expect(screen.getByDisplayValue("12 شارع الهرم")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /12 شارع الهرم/ })).toBeChecked();

    // A new address: typed, and kept for next time.
    fireEvent.click(screen.getByRole("radio", { name: ar.storefront.checkoutAccount.newAddress }));
    expect(screen.getByLabelText(new RegExp(ar.storefront.checkout.address))).toHaveValue("");
    fireEvent.change(screen.getByLabelText(new RegExp(ar.storefront.checkout.governorate)), { target: { value: "القاهرة" } });
    fireEvent.change(screen.getByLabelText(new RegExp(ar.storefront.checkout.address)), { target: { value: "5 شارع النيل، الدور 2" } });
    expect(screen.getByRole("checkbox", { name: ar.storefront.checkoutAccount.saveAddress })).toBeChecked();

    await waitFor(() => expect(screen.getByRole("button", { name: ar.storefront.checkout.submit })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.checkout.submit }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/checkout/done?order=77&total=300"));
    expect(calls.find((c) => c.url.endsWith("/orders"))!.body).toMatchObject({ save_address: true, customer: { name: "سارة", governorate: "القاهرة", address: "5 شارع النيل، الدور 2" } });
  });
});

describe("account", () => {
  const profile = { name: "سارة", email: null, phone: "+201012345678", addresses: [] };
  const noOrders = () => Response.json({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } });

  it("asks before signing out", async () => {
    stub({ "/account/sign-out": () => new Response(null, { status: 204 }), "/account/orders": noOrders, "/store/account": () => Response.json({ data: profile }) });
    inTheme(<AccountView />);
    fireEvent.click(await screen.findByRole("button", { name: ar.storefront.account.signOut }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(ar.storefront.account.signOutTitle);
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.account.cancel }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(calls.some((c) => c.url.includes("/sign-out"))).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: ar.storefront.account.signOut }));
    const buttons = screen.getAllByRole("button", { name: ar.storefront.account.signOut });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(calls.some((c) => c.url.includes("/sign-out") && c.method === "POST")).toBe(true);
  });

  it("saves an optional email on my details", async () => {
    stub({ "/account/orders": noOrders, "/store/account": () => Response.json({ data: profile }) });
    inTheme(<AccountView />);
    fireEvent.click(await screen.findByRole("tab", { name: ar.storefront.account.tabs.profile }));
    fireEvent.change(screen.getByLabelText(new RegExp(ar.storefront.account.email)), { target: { value: "sara@mail.com" } });
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.account.save }));
    await screen.findByText(ar.storefront.account.saved);
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ name: "سارة", email: "sara@mail.com" });
  });
});

describe("reviews on the product page", () => {
  const empty = { data: [], meta: { current_page: 1, last_page: 1, summary: { average: 0, count: 0, stars: {} } } };

  it("asks a visitor to sign in to review", async () => {
    stub({ "/store/reviews": () => Response.json(empty), "/store/account": () => Response.json({ code: "signed_out" }, { status: 401 }) });
    inTheme(<ProductReviewsSection productId={7} slug="shirt" summary={{ average: 0, count: 0, stars: {} }} />);
    expect(await screen.findByRole("link", { name: ar.storefront.reviews.signIn })).toHaveAttribute("href", "/account/login?next=%2Fproducts%2Fshirt%23reviews");
  });

  it("lets a customer who received it review from the product page, and shows the fresh list", async () => {
    let written = false;
    const review = { id: 1, name: "سارة م.", rating: 4, text: "حلو", verified: true, created_at: "2026-11-12T10:00:00Z" };
    stub({
      "/store/reviews": () => Response.json(written ? { data: [review], meta: { current_page: 1, last_page: 1, summary: { average: 4, count: 1, stars: { "4": 1 } } } } : empty),
      "/account/reviews": () => {
        if (calls[calls.length - 1].method === "PUT") {
          written = true;
          return Response.json({ data: { rating: 4, text: "حلو" } });
        }
        return Response.json({ data: { can_review: true, review: written ? { rating: 4, text: "حلو" } : null } });
      },
      "/store/account": () => Response.json({ data: { name: "سارة", email: null, phone: "+201012345678", addresses: [] } }),
    });
    inTheme(<ProductReviewsSection productId={7} slug="shirt" summary={{ average: 0, count: 0, stars: {} }} />);

    fireEvent.click(await screen.findByRole("button", { name: ar.storefront.reviews.rate }));
    fireEvent.click(screen.getByRole("radio", { name: ar.storefront.account.star(4) }));
    fireEvent.change(screen.getByLabelText(new RegExp(ar.storefront.account.reviewText)), { target: { value: "حلو" } });
    fireEvent.click(screen.getByRole("button", { name: ar.storefront.account.reviewSave }));

    expect(await screen.findByText("سارة م.")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ product_id: 7, rating: 4, text: "حلو" });
  });
});
