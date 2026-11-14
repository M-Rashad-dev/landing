import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import { StorePageEditor } from "./page-form";
import { StorePagesPage } from "./pages-page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }), usePathname: () => "/dashboard/design/pages", useSearchParams: () => new URLSearchParams(), notFound: () => null }));
vi.mock("@/lib/auth/session-context", () => ({ useSession: () => ({ storeUrl: "https://naanaa.com", store_name: "نعناع" }) }));

const t = ar.storePages;
const about = { id: 1, title: "من نحن", slug: "about-us", body: "قصتنا", is_published: true, seo: null, position: 1 };
let calls: Array<{ url: string; method: string; body: unknown }> = [];

beforeEach(() => {
  calls = [];
  replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: String(url), method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (method === "GET") return Response.json({ data: [about] });
      if (method === "POST") return Response.json({ data: { ...about, id: 9, ...JSON.parse(String(init!.body)) } }, { status: 201 });
      return Response.json({ data: { ...about, ...JSON.parse(String(init!.body)) } });
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

describe("store pages", () => {
  it("lists the pages, hides one in place, and suggests the templates not added yet", async () => {
    wrap(<StorePagesPage />);
    expect(await screen.findByText("من نحن")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(t.templates.about.hint) })).toBeNull();
    expect(screen.getByRole("link", { name: new RegExp(t.templates.privacy.title) })).toHaveAttribute("href", "/dashboard/design/pages/new?template=privacy");

    fireEvent.click(screen.getByRole("switch", { name: t.visible }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({ title: "من نحن", is_published: false }));
  });

  it("starts a page from a template and saves it", async () => {
    wrap(<StorePageEditor id={null} templateKey="returns" />);
    expect(await screen.findByDisplayValue(t.templates.returns.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard/design/pages/9"));
    expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({ title: t.templates.returns.title, slug: "return-policy", is_published: true });
  });

  it("asks for a title", async () => {
    wrap(<StorePageEditor id={null} templateKey={null} />);
    fireEvent.change(await screen.findByLabelText(new RegExp(t.form.pageTitle)), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText(new RegExp(t.form.pageTitle)), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    expect(await screen.findByText(t.form.titleRequired)).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
});
