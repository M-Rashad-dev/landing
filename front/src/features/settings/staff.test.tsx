import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { navigationOf } from "@/config/navigation";
import { canOpen, pagePermission } from "@/lib/auth/permissions";
import { SessionProvider } from "@/lib/auth/session-context";
import { ar } from "@/messages/ar";
import { InviteForm } from "@/features/auth/invite-form";
import { StaffPage, type PermissionPage } from "./staff-page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace }), usePathname: () => "/dashboard/settings/staff", useSearchParams: () => new URLSearchParams() }));

const t = ar.staff;
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrap(ui: React.ReactNode, permissions: string[] = ["*"]) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <SessionProvider value={{ user: { id: 1, name: "محمد", role: permissions.includes("*") ? "owner" : "staff", permissions }, tenant: { name: "نعناع" }, plan: { features: {}, limits: { staff_accounts: { limit: 3, unlimited: false } } }, store_name: "نعناع", storeUrl: null } as never}>{ui}</SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

const catalog: PermissionPage[] = [
  { page: "orders", label: "الطلبات", group: "المبيعات", actions: [{ key: "orders.view", label: "عرض", grantable: true }, { key: "orders.status", label: "تغيير الحالة", grantable: true }] },
  { page: "billing", label: "الباقة والفواتير", group: "الإعدادات", actions: [{ key: "billing.view", label: "عرض", grantable: false }] },
];

const route = (url: string) => {
  if (url.endsWith("/dashboard/staff/permissions")) return Response.json({ data: catalog });
  if (url.endsWith("/dashboard/staff")) return Response.json({ data: [] });
  return Response.json({ data: { id: 9 } }, { status: 201 });
};

describe("what staff may open", () => {
  it("maps pages to permissions and hides the rest of the sidebar", () => {
    expect(pagePermission("/dashboard")).toBe("home.view");
    expect(pagePermission("/dashboard/orders/123")).toBe("orders.view");
    expect(pagePermission("/dashboard/orders/confirm")).toBe("orders.confirm");
    expect(pagePermission("/dashboard/settings/account")).toBeNull();
    expect(canOpen(["orders.view"], "/dashboard/catalog/products")).toBe(false);
    expect(canOpen(undefined, "/dashboard/catalog/products")).toBe(true);

    const nav = navigationOf("dashboard", ["orders.view"]);
    const hrefs = nav.groups.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/dashboard/orders");
    expect(hrefs).not.toContain("/dashboard/catalog/products");
    expect(hrefs).not.toContain("/dashboard");
  });
});

describe("«الموظفين»", () => {
  it("adds a staff member with the permissions ticked (never the ones the person can't give)", async () => {
    fetchMock.mockImplementation(async (url: string) => route(String(url)));
    wrap(<StaffPage />);

    expect(await screen.findByText(t.empty)).toBeInTheDocument();
    expect(screen.getByText(t.seats(0, 3))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.add) }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("checkbox", { name: "الباقة والفواتير: عرض" })).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(t.name), { target: { value: "منى" } });
    fireEvent.change(within(dialog).getByLabelText(t.email), { target: { value: "mona@example.com" } });
    fireEvent.change(within(dialog).getByLabelText(t.phone), { target: { value: "01055556666" } });
    fireEvent.click(within(dialog).getByRole("button", { name: t.all }));
    fireEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(true));
    const [, init] = fetchMock.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === "POST") as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ name: "منى", email: "mona@example.com", phone: "01055556666", permissions: ["orders.view", "orders.status"] });
  });

  it("hides «ضيف موظف» from staff without the permission", async () => {
    fetchMock.mockImplementation(async (url: string) => route(String(url)));
    wrap(<StaffPage />, ["staff.view"]);
    expect(await screen.findByText(t.empty)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(t.add) })).not.toBeInTheDocument();
  });
});

describe("the invitation link", () => {
  it("greets the person, sets the password and opens the dashboard", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { name: "منى", email: "mona@example.com", store: "نعناع" } }));
    render(<InviteForm token={"a".repeat(48)} />);
    expect(await screen.findByText(t.invite.title("نعناع"))).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(Response.json({ data: { user: { id: 2 } } }));
    fireEvent.change(screen.getByLabelText(t.invite.password), { target: { value: "secret-pass-1" } });
    fireEvent.change(screen.getByLabelText(t.invite.confirm), { target: { value: "secret-pass-1" } });
    fireEvent.click(screen.getByRole("button", { name: t.invite.submit }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual({ token: "a".repeat(48), password: "secret-pass-1", password_confirmation: "secret-pass-1" });
  });

  it("says when the link can't be used", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ code: "invitation_invalid" }, { status: 410 }));
    render(<InviteForm token={"a".repeat(48)} />);
    expect(await screen.findByText(t.invite.invalidTitle)).toBeInTheDocument();
  });
});
