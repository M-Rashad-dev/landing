// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as upload } from "./uploads/route";

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.LARAVEL_INTERNAL_URL = "http://laravel.test";
  process.env.INTERNAL_API_KEY = "internal-key";
  process.env.APP_HOST = "app.maksab.test";
  process.env.PLATFORM_DOMAIN = "maksab.test";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const send = (form: FormData) => new Request("http://shop.example.com/api/public/uploads", { method: "POST", body: form, headers: { host: "shop.example.com", "x-forwarded-for": "41.1.1.1" } });

describe("«حسب الطلب» uploads", () => {
  it("relays the file with the store's host and the visitor's IP (never the visitor's own)", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: { token: "a".repeat(40), name: "me.jpg", size: 3 } }, { status: 201 }));
    const form = new FormData();
    form.set("input_id", "12");
    form.set("host", "evil.com");
    form.set("file", new File(["abc"], "me.jpg", { type: "image/jpeg" }));

    const response = await upload(send(form));

    expect(response.status).toBe(201);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://laravel.test/api/v1/public/uploads");
    const body = init.body as FormData;
    expect(body.get("host")).toBe("shop.example.com");
    expect(body.get("ip")).toBe("41.1.1.1");
    expect(body.get("input_id")).toBe("12");
    expect((body.get("file") as File).name).toBe("me.jpg");
    expect(new Headers(init.headers).get("X-Internal-Key")).toBe("internal-key");
  });

  it("refuses a request without a file or a field, or a file over 10 MB", async () => {
    const noFile = new FormData();
    noFile.set("input_id", "12");
    expect((await upload(send(noFile))).status).toBe(400);

    const badId = new FormData();
    badId.set("input_id", "x");
    badId.set("file", new File(["abc"], "a.jpg"));
    expect((await upload(send(badId))).status).toBe(400);

    const big = new FormData();
    big.set("input_id", "12");
    big.set("file", new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg"));
    expect((await upload(send(big))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("receipts for prepaid orders", () => {
  it("relays the receipt with the store's host, and refuses a bad token", async () => {
    const { POST: pay } = await import("./payments/route");
    fetchMock.mockResolvedValue(Response.json({ data: { can_send: false } }, { status: 201 }));
    const form = new FormData();
    form.set("token", "abcdefabcdef");
    form.set("method_id", "3");
    form.set("sender_ref", " 0109 ");
    form.set("receipt", new File(["abc"], "r.jpg", { type: "image/jpeg" }));

    expect((await pay(new Request("http://shop.example.com/api/public/payments", { method: "POST", body: form, headers: { host: "shop.example.com" } }))).status).toBe(201);
    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as FormData;
    expect(body.get("host")).toBe("shop.example.com");
    expect(body.get("sender_ref")).toBe("0109");
    expect(body.get("method_id")).toBe("3");

    const bad = new FormData();
    bad.set("token", "NOPE");
    bad.set("method_id", "3");
    bad.set("receipt", new File(["abc"], "r.jpg"));
    expect((await pay(new Request("http://shop.example.com/api/public/payments", { method: "POST", body: bad, headers: { host: "shop.example.com" } }))).status).toBe(400);
  });
});
