import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cartPayload, lineKey, type CartItem } from "@/lib/store/cart";
import type { ProductInput } from "@/lib/store/types";
import { EMPTY, fromDetail, toPayload } from "@/features/catalog/products/form-model";
import type { ProductDetail } from "@/features/catalog/products/api";
import { ar } from "@/messages/ar";
import { CustomerInputFields, useCustomerInputs, type CustomerInputsState } from "./customer-inputs";

const t = ar.storefront.inputs;
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const INPUTS: ProductInput[] = [
  { id: 1, kind: "text", label: "الاسم على المج", placeholder: "مثلاً: أحمد", is_required: true, price_delta: 10 },
  { id: 2, kind: "textarea", label: "ملاحظات", placeholder: null, is_required: false, price_delta: 0 },
  { id: 3, kind: "image", label: "صورتك", placeholder: null, is_required: true, price_delta: 25 },
];

function Fields({ onState, live = true }: { onState: (s: CustomerInputsState) => void; live?: boolean }) {
  const state = useCustomerInputs(INPUTS, live);
  onState(state);
  return <CustomerInputFields state={state} />;
}

describe("«حسب الطلب» fields on a product", () => {
  it("marks the required ones, prices what's filled, and sends texts and the upload token", async () => {
    let state!: CustomerInputsState;
    render(<Fields onState={(s) => (state = s)} />);

    expect(screen.getByText("(+10 ج.م)", { exact: false })).toBeInTheDocument();
    act(() => void state.check());
    expect(screen.getByText(t.typeFirst("الاسم على المج"))).toBeInTheDocument();
    expect(screen.getByText(t.uploadFirst("صورتك"))).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/الاسم على المج/), { target: { value: " أحمد " } });
    fetchMock.mockResolvedValueOnce(Response.json({ data: { token: "a".repeat(40), name: "me.jpg", size: 10 } }, { status: 201 }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([new Uint8Array(10)], "me.jpg", { type: "image/jpeg" })] } });

    expect(await screen.findByText("me.jpg")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/uploads");
    expect((init.body as FormData).get("input_id")).toBe("3");
    expect(state.payload()).toEqual({ 1: "أحمد", 3: "a".repeat(40) });
    expect(state.delta).toBe(35);
    expect(state.label()).toBe("الاسم على المج: أحمد، صورتك: me.jpg");
    expect(state.missing).toEqual([]);
  });

  it("refuses big files and non-images before sending, and shows the server's reason", async () => {
    let state!: CustomerInputsState;
    render(<Fields onState={(s) => (state = s)} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [new File([new Uint8Array(11 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByText(t.tooBig(10))).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [new File(["x"], "cv.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByText(t.imageOnly)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(Response.json({ errors: { file: ["الملف ده مش مسموح."] } }, { status: 422 }));
    fireEvent.change(input, { target: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
    expect(await screen.findByText("الملف ده مش مسموح.")).toBeInTheDocument();
    expect(state.payload()).toEqual({});

    act(() => state.setServerErrors({ "items.0.inputs.1": "الاسم طويل" }));
    expect(screen.getByText("الاسم طويل")).toBeInTheDocument();
  });

  it("uploads nothing from a preview", async () => {
    const { result } = renderHook(() => useCustomerInputs(INPUTS, false));
    await act(() => result.current.upload(INPUTS[2], new File(["x"], "a.png", { type: "image/png" })));
    expect(fetchMock).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.files[3]).toBe("a.png"));
  });
});

describe("the cart and the product form", () => {
  it("keeps different answers on different lines and sends them", () => {
    const base: CartItem = { product_id: 7, quantity: 1, options: {}, name: "مج", slug: "mug", image: null, price: 185, options_label: "" };
    expect(lineKey({ ...base, inputs: { 1: "أحمد" } })).not.toBe(lineKey({ ...base, inputs: { 1: "منى" } }));
    expect(lineKey(base)).toBe("7|");
    expect(cartPayload({ items: [{ ...base, inputs: { 1: "أحمد" } }, base] })).toEqual([
      { product_id: 7, quantity: 1, options: {}, inputs: { 1: "أحمد" } },
      { product_id: 7, quantity: 1, options: {} },
    ]);
  });

  it("round-trips the fields of a product", () => {
    const body = toPayload({ ...EMPTY, name: "مج", price: "150", inputs: [{ id: null, kind: "image", label: " صورتك ", placeholder: "ignored", is_required: true, price_delta: "25" }] });
    expect(body.inputs).toEqual([{ kind: "image", label: "صورتك", placeholder: null, is_required: true, price_delta: "25" }]);

    const values = fromDetail({ ...({} as ProductDetail), name: "مج", price: 150, options: [], variants: [], media: [], category_ids: [], inputs: [{ id: 4, kind: "text", label: "الاسم", placeholder: null, is_required: false, price_delta: 0 }] } as ProductDetail);
    expect(values.inputs).toEqual([{ id: 4, kind: "text", label: "الاسم", placeholder: "", is_required: false, price_delta: "" }]);
  });
});
