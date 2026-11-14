import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import { ThemePage } from "./theme-page";

vi.mock("@/lib/auth/session-context", () => ({ usePlanFeature: () => true, useSession: () => ({ plan: null }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/design/theme", useSearchParams: () => new URLSearchParams() }));

const t = ar.design.page;
let owned: string[] = ["asas"];
const store = () => ({
  exists: true,
  themes: owned.map((key) => ({ key, name: key === "asas" ? "أساس" : "صوفي", short_description: null, active: key === "asas", free: key === "asas" })),
  design: { published_at: null, has_unpublished_changes: true },
});
const themeStore = [
  { key: "asas", name: "أساس", short_description: null, price: null, is_free: true, cover: null },
  { key: "sufi", name: "صوفي", short_description: "ثيم متجر فخم", price: { original: 990, final: 990, discount_percent: 0, discount_ends_at: null }, is_free: false, cover: null, features: ["16 قسم للرئيسية"] },
];

beforeEach(() => {
  owned = ["asas"];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("theme-store")) return Response.json({ data: themeStore });
      if (init?.method === "PUT") return Response.json({ data: store() });
      return Response.json({ data: store() });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrap() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <ThemePage />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("ThemePage", () => {
  it("offers the paid themes the store does not own, with their price and the checkout", async () => {
    wrap();
    const card = (await screen.findByText("ثيم متجر فخم")).closest("article")!;
    expect(within(card).getByText("صوفي")).toBeInTheDocument();
    expect(within(card).getByText("16 قسم للرئيسية")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: t.buy })).toHaveAttribute("href", "/dashboard/settings/billing/checkout?theme=sufi");
  });

  it("moves a bought theme to «ثيماتي» and switches the store to it", async () => {
    owned = ["asas", "sufi"];
    wrap();
    expect(await screen.findByText(t.noPaid)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.activate }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: t.activate }));
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "PUT")).toBe(true));
    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PUT")!;
    expect(JSON.parse(String((put[1] as RequestInit).body))).toEqual({ theme_key: "sufi" });
  });
});
