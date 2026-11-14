import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { SessionProvider } from "@/lib/auth/session-context";
import { ar } from "@/messages/ar";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }), usePathname: () => "/dashboard/store", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/media/compress", () => ({ IMAGE_ACCEPT: "image/*", ImageRejected: class extends Error {}, prepareImage: async (f: File) => new File([f], "receipt.webp", { type: "image/webp" }) }));

const { shownStatus } = await import("./billing-api");
const { ReceiptForm } = await import("./checkout");
const { StorePage } = await import("@/features/store/store-page");

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrap(ui: React.ReactNode, features: Record<string, boolean> = { store: true }) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <SessionProvider value={{ user: { name: "محمد" }, tenant: { name: "نعناع" }, plan: { features, limits: {} }, store_name: "نعناع", storeUrl: "https://naanaa.mksab.com" } as never}>{ui}</SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("invoices as the merchant reads them", () => {
  it("shows review, accepted, rejected with its reason, refunded", () => {
    const rejected = { id: 1, status: "rejected" as const, reject_reason: "المبلغ ناقص", method: { key: "instapay", name: "إنستاباي" }, amount: 100, sender_ref: null, created_at: null, reviewed_at: null };
    expect(shownStatus({ status: "pending_review", payments: [] })).toBe("pending_review");
    expect(shownStatus({ status: "paid", payments: [] })).toBe("paid");
    expect(shownStatus({ status: "open", payments: [rejected] })).toBe("rejected");
    expect(shownStatus({ status: "expired", payments: [rejected] })).toBe("rejected");
    expect(shownStatus({ status: "refunded", payments: [] })).toBe("refunded");
  });
});

describe("ReceiptForm", () => {
  it("sends the chosen method, the reference and the compressed receipt", async () => {
    const submit = vi.fn(async () => ({ id: 9 }) as never);
    const onDone = vi.fn();
    wrap(
      <ReceiptForm
        methods={[{ key: "instapay", name: "إنستاباي", kind: "manual", type: "transfer", amount: 100, account_label: "رقم انستاباي", account_value: "01000000000", instructions: null, reference: "ST-00025" }]}
        total={100}
        submit={submit}
        onDone={onDone}
      />,
    );
    expect(screen.getByText("ST-00025")).toBeInTheDocument();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([new Uint8Array(10)], "r.png", { type: "image/png" })] } });
    fireEvent.change(screen.getByLabelText(new RegExp(ar.settings.checkout.senderRef)), { target: { value: "TX-1" } });
    fireEvent.click(screen.getByRole("button", { name: ar.settings.checkout.send }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const [fields, receipt] = submit.mock.calls[0] as unknown as [Record<string, string>, File];
    expect(fields).toEqual({ method: "instapay", sender_ref: "TX-1" });
    expect(receipt.name).toBe("receipt.webp");
  });
});

describe("StorePage", () => {
  it("lists what stops the store and offers the fix, with cash on delivery the only live payment", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ data: { exists: true, is_enabled: false, live: false, theme_key: "asas", design: { published_at: null, has_unpublished_changes: true, updated_at: null }, themes: [{ key: "asas", name: "أساس", short_description: null, active: true, free: true }], counts: { products: 3, categories: 1 } } }),
    );
    wrap(<StorePage />);
    expect(await screen.findByText(ar.settings.store.reasons.home)).toBeInTheDocument();
    expect(screen.getByText(ar.settings.store.reasons.enabled)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ar.settings.store.publishHome })).toHaveAttribute("href", "/dashboard/design/builder");
    expect(screen.getAllByText(ar.settings.store.soon)).toHaveLength(5);
    expect(screen.getAllByText(ar.settings.store.active)).toHaveLength(1);
  });

  it("asks for an upgrade when the plan has no store", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: { exists: false, live: false } }));
    wrap(<StorePage />, { store: false });
    expect(await screen.findByText(ar.settings.store.reasons.plan)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ar.settings.store.upgrade })).toHaveAttribute("href", "/dashboard/settings/billing");
  });
});
