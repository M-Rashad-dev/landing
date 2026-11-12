// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST, PUT } from "./store/account/[[...path]]/route";

const fetchMock = vi.fn();
const TOKEN = "a".repeat(64);

beforeEach(() => {
  process.env.LARAVEL_INTERNAL_URL = "http://laravel.test";
  process.env.INTERNAL_API_KEY = "internal-key";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });
const req = (path: string, init: { method?: string; body?: unknown; origin?: string | null; cookie?: string } = {}) => {
  const headers = new Headers({ host: "shop.example.com", "content-type": "application/json", "x-forwarded-for": "41.0.0.1" });
  if (init.origin !== null) headers.set("origin", init.origin ?? "http://shop.example.com");
  if (init.cookie) headers.set("cookie", init.cookie);
  return new Request(`http://shop.example.com/api/public/store/account${path}`, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
};

describe("store account endpoints", () => {
  it("keeps the sign-in token in an httpOnly cookie, never in the page", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { token: TOKEN, customer: { name: "سارة", phone: "+201012345678", addresses: [] } } }));
    const response = await POST(req("/verify", { method: "POST", body: { phone: "01012345678", code: "123456", host: "evil.com" } }), ctx("verify"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { customer: { name: "سارة", phone: "+201012345678", addresses: [] } } });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`as_customer=${TOKEN}`);
    expect(cookie.toLowerCase()).toContain("httponly");
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toMatchObject({ phone: "01012345678", code: "123456", host: "shop.example.com", ip: "41.0.0.1" });
  });

  it("sends the cookie's token to Laravel and clears it when it no longer works", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ code: "signed_out" }, { status: 401 }));
    const response = await GET(req("/orders?page=2", { cookie: `other=1; as_customer=${TOKEN}` }), ctx("orders"));

    expect(response.status).toBe(401);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://laravel.test/api/v1/public/store/account/orders?host=shop.example.com&page=2");
    expect((init.headers as Headers).get("X-Customer-Token")).toBe(TOKEN);
    expect(response.headers.get("set-cookie")).toContain("as_customer=;");
  });

  it("refuses unknown calls, changes from other sites, and extra fields", async () => {
    expect((await GET(req("/orders/x"), ctx("orders", "x"))).status).toBe(404);
    expect((await POST(req("/admin", { method: "POST", body: {} }), ctx("admin"))).status).toBe(404);
    expect((await PUT(req("", { method: "PUT", body: { name: "x" }, origin: "https://evil.com" }), ctx())).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(Response.json({ data: { rating: 5, text: null } }));
    await PUT(req("/reviews", { method: "PUT", body: { product_id: 3, rating: 5, text: null, customer_id: 99, is_hidden: false }, cookie: `as_customer=${TOKEN}` }), ctx("reviews"));
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).not.toHaveProperty("customer_id");
    expect(sent).not.toHaveProperty("is_hidden");
    expect(sent).toMatchObject({ product_id: 3, rating: 5 });
  });
});
