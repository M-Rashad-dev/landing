import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { SessionProvider } from "@/lib/auth/session-context";
import { ar } from "@/messages/ar";
import { WhatsAppConfirmSettings, type ConfirmSettings } from "./whatsapp-confirm-settings";

const t = ar.orders.autoConfirm;
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const base: ConfirmSettings = { available: true, enabled: false, delay_minutes: 0, reminder_hours: 6, final_hours: 24, on_timeout: "keep", stats: { sent: 0, reminded: 0, confirmed: 12, cancelled: 2, needs_call: 1, no_reply: 3, failed: 0 } };

function wrap(permissions: string[] = ["*"]) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <SessionProvider value={{ user: { id: 1, name: "م", role: "owner", permissions }, tenant: { name: "x" }, plan: null, store_name: "x", storeUrl: null } as never}>
          <WhatsAppConfirmSettings />
        </SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("WhatsApp confirmation settings", () => {
  it("turns it on and shows how the last 30 days went", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: base }));
    wrap();
    expect(await screen.findByText(t.stats.confirmed)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(Response.json({ data: { ...base, enabled: true } }));
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual({ enabled: true, delay_minutes: 0, reminder_hours: 6, final_hours: 24, on_timeout: "keep" });
    expect(await screen.findByText(t.finalWait)).toBeInTheDocument();
  });

  it("says when WhatsApp isn't ready, and stays read-only without the permission", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { ...base, available: false } }));
    wrap(["orders.confirm"]);
    expect(await screen.findByText(t.unavailable)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeDisabled();
  });
});
