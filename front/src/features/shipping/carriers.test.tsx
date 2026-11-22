import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { BulkShipDialog } from "@/features/orders/bulk-ship";
import { ShippingCard } from "@/features/orders/shipment-card";
import type { OrderDetail } from "@/features/orders/api";
import { ar } from "@/messages/ar";
import { CarriersSection } from "./carriers-section";
import { labelsUrl, type Carrier, type CarrierAccount, type ShipPrepare } from "./carriers-api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard/shipping", useSearchParams: () => new URLSearchParams() }));

const t = ar.carriers;
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

const account: CarrierAccount = {
  id: 1,
  carrier: "bosta",
  mode: "own",
  account_name: "متجر حبة",
  status: "active",
  last_error: null,
  checked_at: null,
  settings: { location_id: "loc-main", allow_open: false, package_type: "Parcel", size: "SMALL", label_size: "A4", auto_ship: false, notes: null },
  company: { id: 9, name: "بوسطة", is_active: false },
  open_shipments: 0,
};

const order = {
  id: 5,
  order_number: 1042,
  status: "confirmed",
  governorate: "القاهرة",
  city: "مدينة نصر",
  shipping: { company: { id: 9, name: "بوسطة" }, offer: null, discount: 0, tracking_number: null },
  shipment: null,
} as unknown as OrderDetail;

describe("CarriersSection", () => {
  it("connects Bosta with the key, after showing where to find it", async () => {
    const carriers: Carrier[] = [{ key: "bosta", name: "بوسطة", account: null }];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/dashboard/shipping/carriers") && (!init?.method || init.method === "GET")) return Response.json({ data: carriers });
      if (String(url).endsWith("/dashboard/shipping/carriers/bosta") && init?.method === "POST") return Response.json({ data: account });
      return Response.json({ data: [] });
    });
    const user = userEvent.setup();
    wrap(<CarriersSection companies={[]} onEditCompany={() => undefined} />);

    fireEvent.click(await screen.findByRole("button", { name: new RegExp(t.connect) }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(t.connectDialog.steps("بوسطة")[1])).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: t.connectDialog.submit }));
    expect(await within(dialog).findByText(ar.validation.min(8))).toBeInTheDocument();

    await user.type(within(dialog).getByRole("textbox"), "live-key-123");
    fireEvent.click(within(dialog).getByRole("button", { name: t.connectDialog.submit }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith("/carriers/bosta") && i?.method === "POST")));
    const [, init] = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith("/carriers/bosta") && i?.method === "POST")!;
    expect(JSON.parse(String(init.body))).toEqual({ api_key: "live-key-123", company_id: null });
  });

  it("asks to price and switch on the new company, and shows a stopped connection with its reason", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [{ key: "bosta", name: "بوسطة", account: { ...account, status: "failed", last_error: "مفتاح بوسطة مش صحيح" } }] }));
    const onEdit = vi.fn();
    wrap(<CarriersSection companies={[]} onEditCompany={onEdit} />);

    expect(await screen.findByText(t.failed)).toBeInTheDocument();
    expect(screen.getByText("مفتاح بوسطة مش صحيح")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.setPrices }));
    expect(onEdit).toHaveBeenCalledWith(9);
  });
});

describe("Shipping an order", () => {
  it("ships a confirmed order with the matched area and the order total", async () => {
    const prepare: ShipPrepare = { carriers: [{ carrier: "bosta", name: "بوسطة", account }], default_carrier: "bosta", area: { matched: "d-nasr", districts: [], error: null }, cod: 450, items_count: 2, can_ship: true, shipment: null };
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/dashboard/shipping/carriers")) return Response.json({ data: [{ key: "bosta", name: "بوسطة", account }] });
      if (u.includes("/orders/5/shipping")) return Response.json({ data: prepare });
      if (u.endsWith("/orders/5/shipments") && init?.method === "POST") return Response.json({ data: { id: 3, tracking_number: "5108002" } }, { status: 201 });
      return Response.json({ data: [] });
    });
    const onSaved = vi.fn().mockResolvedValue(undefined);
    wrap(<ShippingCard order={order} onSaved={onSaved} />);

    fireEvent.click(await screen.findByRole("button", { name: new RegExp(t.ship.button("بوسطة")) }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(t.ship.areaMatched)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(t.ship.submit) }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith("/orders/5/shipments") && i?.method === "POST")!;
    expect(JSON.parse(String(init.body))).toEqual({ carrier: "bosta", district_id: null, cod: "450", items_count: 2, notes: null, allow_open: false });
  });

  it("makes the merchant pick the area when the address isn't clear", async () => {
    const prepare: ShipPrepare = { carriers: [{ carrier: "bosta", name: "بوسطة", account }], default_carrier: "bosta", area: { matched: null, districts: [{ id: "d-maadi", name: "المعادي" }], error: null }, cod: 450, items_count: 1, can_ship: true, shipment: null };
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.endsWith("/dashboard/shipping/carriers")) return Response.json({ data: [{ key: "bosta", name: "بوسطة", account }] });
      if (u.includes("/orders/5/shipping")) return Response.json({ data: prepare });
      return Response.json({ data: [] });
    });
    wrap(<ShippingCard order={order} onSaved={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: new RegExp(t.ship.button("بوسطة")) }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("combobox", { name: t.ship.area }).catch(() => within(dialog).findByLabelText(t.ship.area));
    fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(t.ship.submit) }));
    expect(await within(dialog).findByText(t.ship.areaNeeded)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith("/orders/5/shipments") && i?.method === "POST")).toBe(false);
  });

  it("shows a shipment with its timeline, airway bill and cancel", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [{ key: "bosta", name: "بوسطة", account }] }));
    const shipped = {
      ...order,
      shipment: {
        id: 3, order_id: 5, carrier: "bosta", carrier_name: "بوسطة", connected: true, tracking_number: "5108002", state: "created", state_label: "مستني المندوب",
        carrier_label: "Pickup requested", cod: 450, exception: null, attempts: 0, is_open: true, can_cancel: true, synced_at: null, created_at: null,
        events: [{ state: "created", state_label: "مستني المندوب", carrier_label: null, note: null, at: "2026-11-22T10:00:00Z" }],
      },
    } as unknown as OrderDetail;
    wrap(<ShippingCard order={shipped} onSaved={vi.fn()} />);

    expect(screen.getByText("5108002")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(t.shipment.label) })).toHaveAttribute("href", labelsUrl({ shipmentIds: [3] }));
    expect(screen.getByRole("button", { name: new RegExp(t.shipment.cancel) })).toBeInTheDocument();
    expect(screen.queryByLabelText(ar.orders.detail.trackingNumber)).not.toBeInTheDocument();
  });
});

describe("Shipping many orders", () => {
  it("ships in steps of ten and lists the ones that didn't go with their reason", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const ids: number[] = JSON.parse(String(init?.body)).order_ids;
      return Response.json({ data: ids.map((id) => (id === 3 ? { order_id: 3, order_number: 1003, ok: false, code: "ship_district_needed", error: "اختار منطقة العميل" } : { order_id: id, order_number: 1000 + id, ok: true, shipment_id: id, tracking_number: `T${id}` })) });
    });
    const onDone = vi.fn().mockResolvedValue(undefined);
    const ids = Array.from({ length: 12 }, (_, i) => i + 1);
    wrap(<BulkShipDialog open ids={ids} onOpenChange={() => undefined} onDone={onDone} />);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.bulk.start) }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("اختار منطقة العميل")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(t.bulk.printShipped) }).getAttribute("href")).toContain("order_ids%5B%5D=1");
  });
});
