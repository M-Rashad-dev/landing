import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Domain } from "@/lib/domains/api";
import { ar } from "@/messages/ar";
import { ConnectWizard, POLL_LIMIT_MS, POLL_MS } from "./connect-wizard";

const pending: Domain = {
  id: 7,
  host: "shop.example.com",
  type: "custom",
  status: "pending",
  is_primary: false,
  verified_at: null,
  check_attempts: 1,
  last_checked_at: "2026-10-27T09:00:00Z",
  last_check_error: "لم نجد السجل بعد.",
  ssl_status: "pending",
  ssl_checked_at: null,
  created_at: "2026-10-27T09:00:00Z",
  instructions: {
    kind: "subdomain",
    zone: "example.com",
    record: { type: "CNAME", name: "shop", value: "cname.platform.com" },
    cloudflare_warning: "لو بتستخدم Cloudflare اجعل السجل DNS only (سحابة رمادية) وليس Proxied.",
  },
};

const fetchMock = vi.fn();
const verifyCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("/domains/7/verify"));

function reply(domain: Domain) {
  return Promise.resolve(new Response(JSON.stringify({ data: domain }), { status: 200, headers: { "Content-Type": "application/json" } }));
}

function renderWizard(initial: Domain | null = pending) {
  return render(<ConnectWizard open initial={initial} onOpenChange={() => undefined} onChanged={() => undefined} onMakePrimary={async () => undefined} />);
}

describe("ConnectWizard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("shows the exact DNS record and the Cloudflare warning", () => {
    renderWizard();
    expect(screen.getByText("CNAME")).toBeTruthy();
    expect(screen.getByText("shop")).toBeTruthy();
    expect(screen.getByText("cname.platform.com")).toBeTruthy();
    expect(screen.getByText(pending.instructions!.cloudflare_warning)).toBeTruthy();
  });

  it("polls every 15 s until the domain is active, then offers to make it primary", async () => {
    fetchMock.mockImplementationOnce(() => reply({ ...pending, check_attempts: 2 })).mockImplementationOnce(() => reply({ ...pending, status: "active", last_check_error: null }));
    renderWizard();
    fireEvent.click(screen.getByText(ar.common.next));
    expect(screen.getByText(pending.last_check_error!)).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(POLL_MS));
    expect(verifyCalls()).toHaveLength(1);
    await act(async () => vi.advanceTimersByTimeAsync(POLL_MS));
    expect(verifyCalls()).toHaveLength(2);

    expect(screen.getByText(ar.domains.wizard.done)).toBeTruthy();
    expect(screen.getByText(ar.domains.wizard.makePrimaryNow)).toBeTruthy();

    // Active: no more checks.
    await act(async () => vi.advanceTimersByTimeAsync(POLL_MS * 3));
    expect(verifyCalls()).toHaveLength(2);
  });

  it("stops fast polling after 5 minutes", async () => {
    fetchMock.mockImplementation(() => reply(pending));
    renderWizard();
    fireEvent.click(screen.getByText(ar.common.next));

    await act(async () => vi.advanceTimersByTimeAsync(POLL_LIMIT_MS + POLL_MS * 2));
    const calls = verifyCalls().length;
    expect(calls).toBe(POLL_LIMIT_MS / POLL_MS);
    expect(screen.getByText(ar.domains.wizard.pollingStopped)).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(POLL_MS * 4));
    expect(verifyCalls()).toHaveLength(calls);
  });
});
