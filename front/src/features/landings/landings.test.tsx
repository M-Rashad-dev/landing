import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderSourceTag } from "@/components/domain/order-status";
import { TooltipProvider } from "@/components/ui/overlay";
import { formatPercent } from "@/lib/format";
import { ar } from "@/messages/ar";
import type { LandingRow, LandingTheme } from "./api";
import { LandingsPage } from "./landings-page";
import { ThemeDetail } from "./theme-detail";
import { ThemeGallery } from "./theme-gallery";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/marketing/landings", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/auth/session-context", () => ({ useSession: () => ({ storeUrl: "https://naanaa.com", store_name: "نعناع" }), usePlanLimit: () => 3, usePlanFeature: () => true }));

const t = ar.landings;

const page: LandingRow = {
  id: 5,
  title: "عرض الساعة",
  slug: "watch",
  status: "published",
  theme_key: "bidaya",
  product_id: 1,
  product: { id: 1, name: "ساعة ذكية", is_active: true, image: null },
  has_unpublished_changes: false,
  locked_by_plan: false,
  published_at: "2026-11-12T10:00:00Z",
  updated_at: "2026-11-12T10:00:00Z",
  stats: { views: 200, orders: 8, conversion: 4 },
};
const bidaya: LandingTheme = { key: "bidaya", name: "بداية", kind: "landing", short_description: "ثيم مجاني", price: { original: 0, final: 0, discount_percent: 0, discount_ends_at: null }, is_free: true, is_featured: false, is_new: true, cover: null, tags: [], min_plan: null, owned: true, features: ["5 أقسام + فورم الطلب"], images: [], description: "وصف" };
const paid: LandingTheme = { ...bidaya, key: "noor", name: "نور", is_free: false, owned: false, price: { original: 200, final: 160, discount_percent: 20, discount_ends_at: "2026-11-23T10:00:00Z" } };

let calls: Array<{ url: string; method: string; body: unknown }>;

beforeEach(() => {
  calls = [];
  push.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, method, body });
      const path = url.replace(/^\/api\/bff/, "").split("?")[0];
      if (path === "/dashboard/pages" && method === "GET") return Response.json({ data: [page], meta: { current_page: 1, last_page: 1, per_page: 24, total: 1, counts: { all: 1, published: 1, draft: 0 } } });
      if (path === "/dashboard/pages" && method === "POST") return Response.json({ data: { ...page, id: 9, ...body, status: "draft" } }, { status: 201 });
      if (path === "/dashboard/pages/5/unpublish") return Response.json({ data: { ...page, status: "draft" } });
      if (path === "/dashboard/theme-store") return Response.json({ data: [bidaya, paid], meta: { tags: [] } });
      if (path === "/dashboard/theme-store/noor") return Response.json({ data: paid });
      if (path === "/dashboard/products") return Response.json({ data: [{ id: 1, name: "ساعة ذكية" }], meta: { current_page: 1, last_page: 1, per_page: 24, total: 1, counts: {} } });
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

describe("landing pages", () => {
  it("lists the pages with their address and last 30 days, and stops publishing one", async () => {
    wrap(<LandingsPage />);
    expect(await screen.findByText("عرض الساعة")).toBeInTheDocument();
    expect(screen.getByText("naanaa.com/watch")).toBeInTheDocument();
    expect(screen.getByText(formatPercent(4))).toBeInTheDocument();
    expect(screen.getByText(t.limit(1, 3))).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("button", { name: `${t.actions.more}: عرض الساعة` }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: t.actions.unpublish }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/dashboard/pages/5/unpublish") && c.method === "POST")).toBe(true));
  });

  it("starts a page on the free theme: the address follows the name, the product is required", async () => {
    wrap(<ThemeGallery />);
    expect(await screen.findByText(t.gallery.paid)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(t.theme.buySoon) })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: t.gallery.use }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(new RegExp(t.create.name)), { target: { value: "Summer Watch" } });
    expect(within(dialog).getByLabelText(new RegExp(t.create.slug))).toHaveValue("summer-watch");
    fireEvent.click(within(dialog).getByRole("button", { name: t.create.confirm }));
    expect(await within(dialog).findByText(t.create.productRequired)).toBeInTheDocument();
  });

  it("shows a paid theme with its discount, and buying waits", async () => {
    wrap(<ThemeDetail themeKey="noor" />);
    expect(await screen.findByText(t.theme.discount(20))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(t.theme.buySoon) })).toBeDisabled();
  });

  it("tags an order that came from a landing page", () => {
    render(<OrderSourceTag source="landing" page={{ title: "عرض الساعة" }} />);
    expect(screen.getByText(`${ar.domain.source.landing}: عرض الساعة`)).toBeInTheDocument();
  });
});
