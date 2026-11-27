import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { SessionProvider } from "@/lib/auth/session-context";
import { ar } from "@/messages/ar";
import { ProductSpecs } from "@/themes/store/shared/specs";
import type { ProductDetail } from "../products/api";
import { EMPTY, fromDetail, productSchema, toPayload } from "../products/form-model";
import type { SpecGroup } from "./api";
import { FillGrid } from "./fill-grid";
import { GroupPage } from "./group-page";
import { SpecGroupsPage } from "./spec-groups-page";

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/dashboard/catalog/spec-groups",
  useSearchParams: () => search,
  notFound: () => {
    throw new Error("not found");
  },
}));

const t = ar.specs;
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  search = new URLSearchParams();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Answers by path (the first matching prefix wins). */
function routes(map: Record<string, (init?: RequestInit) => unknown>) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const path = String(url).replace("/api/bff", "").split("?")[0];
    const key = Object.keys(map).find((k) => `${init?.method ?? "GET"} ${path}` === k || path === k);
    return Promise.resolve(json(key ? map[key](init) : { data: null }));
  });
}

const sent = (method: string, path: string) => {
  const call = fetchMock.mock.calls.find(([url, init]) => String(url).includes(path) && (init?.method ?? "GET") === method);
  return call ? JSON.parse(String(call[1]?.body ?? "null")) : undefined;
};

function wrap(ui: React.ReactNode, permissions: string[] = ["*"]) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <SessionProvider value={{ user: { id: 1, name: "م", role: "owner", permissions }, tenant: { name: "x" }, plan: null, store_name: "x", storeUrl: null } as never}>{ui}</SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

const laptop: SpecGroup = {
  id: 3,
  name: "لابتوب",
  products_count: 2,
  rows: [
    { label: "المعالج", in_card: true, filterable: true },
    { label: "الرامات", in_card: true, filterable: false },
  ],
};

describe("spec groups list", () => {
  it("explains groups with three examples when there are none", async () => {
    routes({ "/dashboard/spec-groups": () => ({ data: [], meta: { max: 100 } }) });
    wrap(<SpecGroupsPage />);

    expect(await screen.findByText(t.groups.emptyTitle)).toBeTruthy();
    for (const example of t.groups.examples) expect(screen.getByText(example.name)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: t.groups.examplesTitle })[0].getAttribute("href")).toBe("/dashboard/catalog/spec-groups/new?example=laptop");
  });

  it("lists groups with their rows and products", async () => {
    routes({ "/dashboard/spec-groups": () => ({ data: [{ id: 3, name: "لابتوب", rows_count: 7, products_count: 12 }], meta: { max: 100 } }) });
    wrap(<SpecGroupsPage />);

    expect(await screen.findByText("لابتوب")).toBeTruthy();
    expect(screen.getByText(t.groups.rows(7))).toBeTruthy();
    expect(screen.getByText(t.groups.products(12))).toBeTruthy();
    expect(screen.getByRole("link", { name: new RegExp("لابتوب") }).getAttribute("href")).toBe("/dashboard/catalog/spec-groups/3");
  });

  it("shows an error with a retry", async () => {
    fetchMock.mockResolvedValue(json({ message: "x" }, 500));
    wrap(<SpecGroupsPage />);
    expect(await screen.findByText(ar.common.errorTitle)).toBeTruthy();
  });
});

describe("a group's rows", () => {
  it("starts a new group from an example and creates it", async () => {
    search = new URLSearchParams("example=laptop");
    routes({ "POST /dashboard/spec-groups": () => ({ data: { ...laptop, id: 9 } }) });
    wrap(<GroupPage id={null} />);

    expect((screen.getByLabelText(new RegExp(t.group.name)) as HTMLInputElement).value).toBe("لابتوب");
    const labels = screen.getAllByLabelText(t.group.label) as HTMLInputElement[];
    expect(labels.map((i) => i.value)).toEqual([...t.groups.examples[0].rows]);

    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard/catalog/spec-groups/9"));
    const body = sent("POST", "/dashboard/spec-groups");
    expect(body.name).toBe("لابتوب");
    expect(body.rows[0]).toEqual({ label: "المعالج", in_card: true, filterable: false });
  });

  it("refuses a fifth card row and a repeated label before sending", async () => {
    search = new URLSearchParams("example=laptop");
    wrap(<GroupPage id={null} />);
    const user = userEvent.setup();

    const switches = screen.getAllByRole("switch");
    // Rows 4 and 5 on the card too (the example has 3): the fifth is refused.
    await user.click(switches[6]);
    await user.click(switches[8]);
    const labels = screen.getAllByLabelText(t.group.label) as HTMLInputElement[];
    await user.clear(labels[1]);
    await user.type(labels[1], "المعالج");
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));

    expect(await screen.findByText(t.group.tooManyCard)).toBeTruthy();
    expect(screen.getByText(t.group.duplicate)).toBeTruthy();
    expect(sent("POST", "/dashboard/spec-groups")).toBeUndefined();
  });

  it("sends the new rows of a group to its products after a confirmation", async () => {
    routes({ "/dashboard/spec-groups/3": () => ({ data: laptop }), "POST /dashboard/spec-groups/3/push": () => ({ data: { updated: 2 } }), "/dashboard/spec-groups": () => ({ data: [], meta: { max: 100 } }) });
    wrap(<GroupPage id={3} />);

    fireEvent.click(await screen.findByRole("button", { name: t.group.push }));
    fireEvent.click(await screen.findByRole("button", { name: t.group.pushConfirm }));
    await waitFor(() => expect(sent("POST", "/dashboard/spec-groups/3/push")).toBeNull());
    // Done: the confirmation closes.
    await waitFor(() => expect(screen.queryByRole("button", { name: t.group.pushConfirm })).toBeNull());
  });

  it("only shows the rows to staff who may not edit products", async () => {
    routes({ "/dashboard/spec-groups/3": () => ({ data: laptop }) });
    wrap(<GroupPage id={3} />, ["products.view"]);

    expect(await screen.findByDisplayValue("المعالج")).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.group.apply })).toBeNull();
    expect(screen.queryByRole("button", { name: t.group.delete })).toBeNull();
    expect((screen.getByDisplayValue("المعالج") as HTMLInputElement).disabled).toBe(true);
  });
});

describe("the fill grid", () => {
  const grid = {
    data: [
      { product_id: 1, name: "لابتوب أ", image: null, values: { المعالج: "Core i5", الرامات: null } },
      { product_id: 2, name: "لابتوب ب", image: null, values: { المعالج: null, الرامات: "8GB" } },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 50, total: 2, labels: ["المعالج", "الرامات"] },
  };

  it("moves down with Enter, highlights changed cells and saves the changed products only", async () => {
    routes({ "/dashboard/spec-groups/3/grid": () => grid, "PUT /dashboard/spec-groups/3/grid": () => ({ data: { updated: 1 } }) });
    wrap(<FillGrid group={laptop} />);
    const user = userEvent.setup();

    const cpuA = (await screen.findByLabelText("لابتوب أ: المعالج")) as HTMLInputElement;
    expect(cpuA.value).toBe("Core i5");
    await user.click(cpuA);
    await user.keyboard("{Enter}");
    const cpuB = screen.getByLabelText("لابتوب ب: المعالج") as HTMLInputElement;
    expect(document.activeElement).toBe(cpuB);
    await user.type(cpuB, "Core i7");
    expect(cpuB.className).toContain("bg-accent-soft");
    expect(screen.getByText(t.grid.changed(1))).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: t.grid.save }));
    await waitFor(() => expect(sent("PUT", "/dashboard/spec-groups/3/grid")).toEqual({ rows: [{ product_id: 2, values: [{ label: "المعالج", value: "Core i7" }] }] }));
  });

  it("says what to do when no product uses the group", async () => {
    routes({ "/dashboard/spec-groups/3/grid": () => ({ data: [], meta: { current_page: 1, last_page: 1, per_page: 50, total: 0, labels: ["المعالج"] } }) });
    wrap(<FillGrid group={laptop} />);
    expect(await screen.findByText(t.grid.emptyTitle)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.group.apply })).toBeTruthy();
  });
});

describe("specs in the product form", () => {
  const table = (rows: Array<{ label: string; value?: string; in_card?: boolean }>, name = "لابتوب", group: number | null = 3) => ({
    spec_group_id: group,
    name,
    rows: rows.map((r) => ({ label: r.label, value: r.value ?? "", in_card: r.in_card ?? false, filterable: false })),
  });
  const base = { ...EMPTY, name: "لابتوب 14", price: "24999" };

  it("reads and sends the tables, empty values as null", () => {
    const values = fromDetail({ ...({} as ProductDetail), ...base, price: 24999, options: [], variants: [], media: [], category_ids: [], specs: [{ id: 1, spec_group_id: 3, name: "لابتوب", rows: [{ label: "المعالج", value: "i5", in_card: true, filterable: true }, { label: "الوزن", value: null, in_card: false, filterable: false }] }], video_url: "https://youtu.be/x" } as unknown as ProductDetail);
    expect(values.specs[0].rows[1].value).toBe("");
    const payload = toPayload(values);
    expect(payload.specs).toEqual([{ spec_group_id: 3, name: "لابتوب", rows: [{ label: "المعالج", value: "i5", in_card: true, filterable: true }, { label: "الوزن", value: null, in_card: false, filterable: false }] }]);
    expect(payload.video_url).toBe("https://youtu.be/x");
  });

  it("refuses a fifth card row, a repeated table or label, a group twice and a non-video link", () => {
    const five = productSchema.safeParse({ ...base, specs: [table([{ label: "1", in_card: true }, { label: "2", in_card: true }, { label: "3", in_card: true }]), table([{ label: "4", in_card: true }, { label: "5", in_card: true }], "ب", null)] });
    expect(five.success).toBe(false);
    expect(five.error?.issues.map((i) => i.path.join("."))).toContain("specs.1.rows.1.in_card");

    const repeated = productSchema.safeParse({ ...base, specs: [table([{ label: "أ" }, { label: " أ " }]), table([{ label: "ب" }], " لابتوب ")] });
    expect(repeated.error?.issues.map((i) => i.path.join("."))).toEqual(expect.arrayContaining(["specs.0.rows.1.label", "specs.1.name"]));

    const twice = productSchema.safeParse({ ...base, specs: [table([{ label: "أ" }]), table([{ label: "أ" }], "تاني")] });
    expect(twice.error?.issues.map((i) => i.message)).toContain(t.product.groupTaken);

    expect(productSchema.safeParse({ ...base, video_url: "https://example.com/v.mp4" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, video_url: "https://vimeo.com/123" }).success).toBe(true);
  });
});

describe("specs on the storefront", () => {
  it("shows each table with its filled rows, and nothing without specs", () => {
    const { container, rerender } = render(<ProductSpecs specs={[{ name: "الأداء", rows: [{ label: "المعالج", value: "Core i5", in_card: true }] }, { name: "الضمان", rows: [{ label: "المدة", value: "سنتين", in_card: false }] }]} />);
    expect(screen.getByRole("heading", { name: t.storefront.title })).toBeTruthy();
    expect(screen.getByText("الأداء")).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "المعالج" }).nextElementSibling?.textContent).toBe("Core i5");

    rerender(<ProductSpecs specs={[]} />);
    expect(container.innerHTML).toBe("");
    rerender(<ProductSpecs specs={undefined} />);
    expect(container.innerHTML).toBe("");
  });
});
