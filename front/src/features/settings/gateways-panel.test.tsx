import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { SessionProvider } from "@/lib/auth/session-context";
import { ar } from "@/messages/ar";
import { GatewaysPanel, type Gateway } from "./gateways-panel";

const t = ar.settings.payments.gateways;
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const paymob: Gateway = {
  key: "paymob",
  label: "Paymob",
  fields: [
    { key: "secret_key", secret: true, label: "Secret Key", hint: "من لوحة Paymob" },
    { key: "integration_ids", secret: false, label: "Integration IDs", hint: "مفصولين بفاصلة" },
  ],
  connected: false,
  mode: null,
  status: null,
  connected_at: null,
  method_id: null,
};

function wrap(gateways: Gateway[], onChange = vi.fn(), permissions = ["*"]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <SessionProvider value={{ user: { id: 1, name: "م", role: "owner", permissions }, tenant: { name: "x" }, plan: null, store_name: "x", storeUrl: null } as never}>
          <GatewaysPanel gateways={gateways} onChange={onChange} />
        </SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return onChange;
}

describe("online payment gateways", () => {
  it("connects with the merchant's keys and shows the gateway's answer", async () => {
    const onChange = wrap([paymob]);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.connect) }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/Secret Key/)).toHaveAttribute("type", "password");

    fireEvent.click(within(dialog).getByRole("button", { name: t.save }));
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(Response.json({ message: "x", errors: { credentials: ["بيانات Paymob مش صح."] } }, { status: 422 }));
    fireEvent.change(within(dialog).getByLabelText(/Secret Key/), { target: { value: " egy_sk_test_x " } });
    fireEvent.change(within(dialog).getByLabelText(/Integration IDs/), { target: { value: "4900123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: t.save }));
    expect(await within(dialog).findByText("بيانات Paymob مش صح.")).toBeInTheDocument();
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({ credentials: { secret_key: "egy_sk_test_x", integration_ids: "4900123" } });

    fetchMock.mockResolvedValueOnce(Response.json({ data: { cod_enabled: true, cancel_after_days: 3, methods: [], gateways: [{ ...paymob, connected: true, mode: "test" }] } }));
    fireEvent.click(within(dialog).getByRole("button", { name: t.save }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("shows a connected gateway's mode, and stays read-only without the permission", () => {
    wrap([{ ...paymob, connected: true, mode: "test", status: "active", connected_at: "2026-11-25T10:00:00Z" }], vi.fn(), ["payments.view"]);
    expect(screen.getByText(t.test)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(t.disconnect) })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(t.connect) })).not.toBeInTheDocument();
  });
});
