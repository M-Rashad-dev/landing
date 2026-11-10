import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import { SessionProvider } from "@/components/dashboard/session-context";
import type { AdminTenantDetail } from "@/lib/admin/api";
import type { Session } from "@/lib/types";
import { ar } from "@/messages/ar";
import { TenantDetails } from "./tenant-details";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

const session: Session = {
  user: { id: 1, name: "Admin", email: "admin@platform.test", phone: "+201000000000", role: "super_admin", last_login_at: null },
  tenant: null,
  primary_host: null,
  plan: null,
  public_origin: { scheme: "https", port: "" },
};

const tenant: AdminTenantDetail = {
  id: 5,
  name: "متجر رشاد",
  status: "active",
  owner: { id: 9, name: "رشاد", email: "rashad@example.com", phone: "+201012345678", last_login_at: null },
  subdomain: "rashad-4821.platform.test",
  primary_host: "rashad-4821.platform.test",
  pages_count: 3,
  published_pages_count: 2,
  orders_count: 14,
  plan_key: "pro",
  plan_state: "active",
  plan_is_trial: false,
  plan_ends_at: "2026-12-01T10:00:00Z",
  created_at: "2026-10-01T10:00:00Z",
  suspended_at: null,
  suspended_reason: null,
  domains: [],
};

const fetchMock = vi.fn();
const json = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { "Content-Type": "application/json" } }));

function renderDetails() {
  return render(
    <Providers>
      <SessionProvider session={session}>
        <TenantDetails id={5} />
      </SessionProvider>
    </Providers>,
  );
}

describe("TenantDetails", () => {
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("shows the temporary password once, after confirming", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/reset-password") && init?.method === "POST") return json({ temporary_password: "Xy7#kLm2Qp9!" });
      return json(tenant);
    });
    renderDetails();

    fireEvent.click(await screen.findByText(ar.admin.tenant.resetPassword));
    expect(screen.queryByText("Xy7#kLm2Qp9!")).toBeNull();
    fireEvent.click(screen.getByText(ar.admin.tenant.resetConfirm));

    expect(await screen.findByText("Xy7#kLm2Qp9!")).toBeTruthy();
    expect(screen.getByText(ar.admin.tenant.temporaryWarning)).toBeTruthy();

    fireEvent.click(screen.getAllByText(ar.common.close).at(-1)!);
    await waitFor(() => expect(screen.queryByText("Xy7#kLm2Qp9!")).toBeNull());
  });

  it("asks for a reason before suspending", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/suspend") && init?.method === "POST") return json({ ...tenant, status: "suspended", suspended_reason: "محتوى مخالف", suspended_at: "2026-10-27T10:00:00Z" });
      return json(tenant);
    });
    renderDetails();

    fireEvent.click(await screen.findByText(ar.admin.tenant.suspend));
    const submit = screen.getAllByText(ar.admin.tenant.suspend).at(-1)!.closest("button")!;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(new RegExp(ar.admin.tenant.reasonLabel)), { target: { value: "محتوى مخالف" } });
    fireEvent.click(submit);

    expect(await screen.findByText(ar.admin.tenant.activate)).toBeTruthy();
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes("/suspend"));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ reason: "محتوى مخالف" });
  });
});
