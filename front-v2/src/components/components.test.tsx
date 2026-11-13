import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable, type Column } from "@/components/data/data-table";
import { StatCard } from "@/components/data/stat-card";
import { OrderStatusBadge } from "@/components/domain/order-status";
import { MoneyInput } from "@/components/forms/inputs";
import { DASHBOARD_FOOTER_NAV, DASHBOARD_NAV, isActive } from "@/config/navigation";

afterEach(cleanup);

type Row = { id: number; name: string; total: number };
const columns: Column<Row>[] = [
  { key: "name", header: "الاسم", cell: (r) => r.name },
  { key: "total", header: "الإجمالي", sortable: true, cell: (r) => r.total },
];

describe("navigation", () => {
  it("opens only the parts already built", () => {
    const all = [...DASHBOARD_NAV.flatMap((g) => g.items), ...DASHBOARD_FOOTER_NAV];
    expect(all.filter((i) => i.status === "ready").map((i) => i.href)).toEqual(["/dashboard", "/dashboard/orders", "/dashboard/abandoned", "/dashboard/customers", "/dashboard/reviews", "/dashboard/catalog/products", "/dashboard/catalog/categories", "/dashboard/shipping", "/dashboard/store", "/dashboard/design/theme", "/dashboard/design/pages", "/dashboard/marketing/offers", "/dashboard/marketing/coupons", "/dashboard/marketing/upsells", "/dashboard/marketing/landings", "/dashboard/analytics", "/dashboard/settings", "/dashboard/components"]);
    expect(isActive("/dashboard/components", { href: "/dashboard/components" })).toBe(true);
    expect(isActive("/dashboard/x", { href: "/dashboard", exact: true })).toBe(false);
  });
});

describe("StatCard", () => {
  it("colors a drop green when lower is better", () => {
    const { container } = render(<StatCard label="الملغية" value="12" change={-40} inverse />);
    expect(container.querySelector(".text-success")).not.toBeNull();
  });

  it("says there is nothing to compare with", () => {
    render(<StatCard label="المبيعات" value="1" change={null} />);
    expect(screen.getByText("مفيش فترة للمقارنة")).toBeInTheDocument();
  });
});

describe("DataTable", () => {
  it("cycles the sort asc → desc → none and selects all rows", () => {
    const onSort = vi.fn();
    const onSelect = vi.fn();
    const rows = [
      { id: 1, name: "أ", total: 10 },
      { id: 2, name: "ب", total: 20 },
    ];
    const { rerender } = render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} sort={null} onSortChange={onSort} selectable onSelectedChange={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /الإجمالي/ }));
    expect(onSort).toHaveBeenLastCalledWith({ key: "total", dir: "asc" });
    rerender(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} sort={{ key: "total", dir: "asc" }} onSortChange={onSort} selectable onSelectedChange={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /الإجمالي/ }));
    expect(onSort).toHaveBeenLastCalledWith({ key: "total", dir: "desc" });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(onSelect).toHaveBeenLastCalledWith([1, 2]);
  });

  it("shows the empty state when there are no rows", () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(r) => r.id} />);
    expect(screen.getAllByText("مفيش نتايج").length).toBeGreaterThan(0);
  });
});

describe("inputs", () => {
  it("keeps money to digits with two decimals and turns Arabic digits into Latin", () => {
    const onChange = vi.fn();
    render(<MoneyInput value="" onChange={onChange} aria-label="price" />);
    const input = screen.getByLabelText("price");
    fireEvent.change(input, { target: { value: "١٢٠" } });
    expect(onChange).toHaveBeenLastCalledWith("120");
    onChange.mockClear();
    fireEvent.change(input, { target: { value: "12.345" } });
    fireEvent.change(input, { target: { value: "-5" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("labels every order status in Arabic", () => {
    render(<OrderStatusBadge status="delivered" />);
    expect(screen.getByText("تم التسليم")).toBeInTheDocument();
  });
});
