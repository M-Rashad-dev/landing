import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseUtm } from "@/lib/tracking/utm";
import { demoContext } from "@/themes/dev/fixtures";
import { useOrderForm } from "@/themes/shared/hooks/use-order-form";
import { SCHEMAS } from "@/themes/shared/schemas";
import type { OrderFormProps } from "@/themes/shared/schemas/order-form";
import { buildFields, buildSchema, validateAll } from "./fields";

const defaults = SCHEMAS.order_form.defaults as unknown as OrderFormProps;

function props(patch: Partial<OrderFormProps> = {}): OrderFormProps {
  return { ...defaults, ...patch, fields: { ...defaults.fields, ...(patch.fields ?? {}) } };
}

describe("order form fields from the settings", () => {
  it("keeps name and phone always on and required, others as configured", () => {
    const fields = buildFields(
      props({
        fields: {
          ...defaults.fields,
          name: { ...defaults.fields.name, enabled: false, required: false },
          phone2: { ...defaults.fields.phone2, enabled: true, required: true },
          notes: { ...defaults.fields.notes, enabled: false },
        },
      }),
    );
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));

    expect(byName["customer.name"].required).toBe(true);
    expect(byName["customer.phone"].required).toBe(true);
    expect(byName["customer.phone2"].required).toBe(true);
    expect(byName["customer.notes"]).toBeUndefined();
    expect(byName["customer.governorate"].choices).toContain("القاهرة");
  });

  it("adds valid custom fields and skips bad keys", () => {
    const fields = buildFields(
      props({
        custom_fields: [
          { key: "color", label: "اللون", type: "select", required: true, placeholder: "", choices: ["أحمر", " أزرق ", ""] },
          { key: "Bad Key", label: "x", type: "text", required: false, placeholder: "", choices: [] },
        ],
      }),
    );
    const color = fields.find((f) => f.name === "answers.color");
    expect(color?.choices).toEqual(["أحمر", "أزرق"]);
    expect(fields.some((f) => f.label === "x")).toBe(false);
  });

  it("generates a zod schema with the same rules as the back end", () => {
    const fields = buildFields(
      props({
        custom_fields: [
          { key: "age", label: "السن", type: "number", required: false, placeholder: "", choices: [] },
          { key: "agree", label: "موافق", type: "checkbox", required: true, placeholder: "", choices: [] },
          { key: "when", label: "الموعد", type: "date", required: false, placeholder: "", choices: [] },
        ],
      }),
    );
    const schema = buildSchema(fields);

    const bad = schema.safeParse({ "customer.name": "أ", "customer.phone": "0123", "customer.governorate": "باريس", "answers.age": "abc", "answers.agree": false, "answers.when": "2026-02-31x" });
    expect(bad.success).toBe(false);
    const failing = new Set(bad.error?.issues.map((issue) => issue.path[0]));
    expect([...failing]).toEqual(expect.arrayContaining(["customer.name", "customer.phone", "customer.governorate", "answers.age", "answers.agree", "answers.when"]));

    const good = schema.safeParse({
      "customer.name": "أحمد علي",
      "customer.phone": "٠١٠١٢٣٤٥٦٧٨",
      "customer.governorate": "الجيزة",
      "customer.address": "شارع النصر",
      "answers.age": "30",
      "answers.agree": true,
    });
    // Missing required values still fail (the schema is optional only for the shape).
    expect(schema.safeParse({ "customer.name": "أحمد علي" }).success).toBe(false);
    expect(good.error?.issues.map((i) => `${String(i.path[0])}: ${i.message}`) ?? []).toEqual([]);
  });

  it("has the same default fields as the back end (OrderForm::DEFAULT_FIELDS)", () => {
    const php = readFileSync(resolve(__dirname, "../../../../../back/app/Support/OrderForm.php"), "utf8");
    const backEnd = Object.fromEntries(
      [...php.matchAll(/'(\w+)' => \['enabled' => (true|false), 'required' => (true|false)\]/g)].map(([, key, enabled, required]) => [key, { enabled: enabled === "true", required: required === "true" }]),
    );
    const front = Object.fromEntries(Object.entries(defaults.fields).map(([key, f]) => [key, { enabled: f.enabled, required: f.required }]));
    expect(backEnd).toEqual(front);
  });

  it("returns Arabic messages per field", () => {
    const fields = buildFields(props());
    const errors = validateAll(fields, { "customer.name": "أحمد", "customer.phone": "123" });
    expect(errors["customer.phone"]).toMatch(/رقم/);
    expect(errors["customer.name"]).toBeUndefined();
  });
});

describe("UTM capture", () => {
  it("keeps the five utm params and the referrer, trimmed in length", () => {
    expect(parseUtm("?utm_source=facebook&utm_medium=cpc&utm_campaign=eid&utm_content=v1&utm_term=shoes&x=1", "https://m.facebook.com/")).toEqual({
      source: "facebook",
      medium: "cpc",
      campaign: "eid",
      content: "v1",
      term: "shoes",
      referrer: "https://m.facebook.com/",
    });
    expect(parseUtm("", "")).toEqual({});
    expect(parseUtm(`?utm_source=${"a".repeat(300)}`, "").source).toHaveLength(200);
  });
});

describe("useOrderForm submit", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("sends one order even when submit is pressed twice, then shows success", async () => {
    let resolveOrder: (value: Response) => void = () => undefined;
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/public/form-token")) return Promise.resolve(new Response(JSON.stringify({ data: { token: "1.abc" } })));
      if (url === "/api/public/quote") return Promise.resolve(new Response(JSON.stringify({ data: null }), { status: 200 }));
      if (url === "/api/public/orders") return new Promise<Response>((resolve) => (resolveOrder = resolve));
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    const ctx = { ...demoContext(), isPreview: false };
    ctx.product = ctx.product ? { ...ctx.product, options: [] } : null;
    const { result } = renderHook(() => useOrderForm(props({ fields: { ...defaults.fields, address: { ...defaults.fields.address, required: false }, governorate: { ...defaults.fields.governorate, required: false } } }), ctx));

    act(() => {
      result.current.setValue("customer.name", "أحمد علي");
      result.current.setValue("customer.phone", "01012345678");
    });

    await act(async () => {
      void result.current.submit();
      void result.current.submit();
    });

    const orderCalls = () => fetchMock.mock.calls.filter(([url]) => url === "/api/public/orders");
    expect(orderCalls()).toHaveLength(1);
    const body = JSON.parse(orderCalls()[0][1].body as string);
    expect(body.customer).toEqual({ name: "أحمد علي", phone: "+201012345678" });
    expect(body.website).toBe("");
    expect(body.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);

    await act(async () => resolveOrder(new Response(JSON.stringify({ data: { order_number: 1042, total: 350 } }), { status: 201 })));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.orderNumber).toBe(1042);
  });

  it("never sends anything in preview mode", async () => {
    const ctx = { ...demoContext(), isPreview: true };
    const { result } = renderHook(() => useOrderForm(props(), ctx));
    act(() => {
      result.current.setValue("customer.name", "أحمد علي");
      result.current.setValue("customer.phone", "01012345678");
      result.current.setValue("customer.governorate", "القاهرة");
      result.current.setValue("customer.address", "شارع");
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
