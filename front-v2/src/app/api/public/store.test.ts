// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { POST as order } from "./store/orders/route";
import { POST as quote } from "./store/quote/route";

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

const visit = (host: string, path: string, cookie?: string) => {
  const headers = new Headers({ host });
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`http://${host}${path}`, { headers });
};
const rewrittenTo = (response: Response) => response.headers.get("x-middleware-rewrite");

describe("host routing", () => {
  it("draws a store host from /sites/{host}, keeping the path for redirects", () => {
    const response = proxy(visit("shop.example.com", "/products/shirt?x=1"));
    expect(rewrittenTo(response)).toBe("http://shop.example.com/sites/shop.example.com/products/shirt?x=1");
    expect(response.headers.get("x-middleware-request-x-site-path")).toBe("/products/shirt?x=1");
    expect(rewrittenTo(proxy(visit("shop.example.com", "/")))).toBe("http://shop.example.com/sites/shop.example.com");
  });

  it("keeps the dashboard and other stores' paths off a store host", () => {
    expect(rewrittenTo(proxy(visit("shop.example.com", "/dashboard")))).toContain("/__not-found");
    expect(rewrittenTo(proxy(visit("shop.example.com", "/sites/other.com")))).toContain("/__not-found");
    expect(rewrittenTo(proxy(visit("shop.example.com", "/api/bff/dashboard/orders")))).toContain("/__not-found");
    expect(rewrittenTo(proxy(visit("shop.example.com", "/api/public/store/quote")))).toBeNull();
  });

  it("keeps store pages off the app host", () => {
    expect(rewrittenTo(proxy(visit("app.maksab.test", "/sites/shop.example.com")))).toContain("/__not-found");
    expect(rewrittenTo(proxy(visit("app.maksab.test", "/products")))).toContain("/__not-found");
    expect(proxy(visit("app.maksab.test", "/dashboard")).headers.get("location")).toContain("/login?next=%2Fdashboard");
  });
});

describe("store visitor endpoints", () => {
  const post = (path: string, body: unknown) =>
    new Request(`http://shop.example.com${path}`, { method: "POST", headers: { host: "shop.example.com", "x-forwarded-for": "41.1.2.3", "user-agent": "phone", "content-type": "application/json" }, body: JSON.stringify(body) });

  it("forwards only the allowed order fields, with the host and the visitor's IP", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { order_number: 1, total: 10 } }, { status: 201 }));
    const response = await order(post("/api/public/store/orders", { items: [{ product_id: 1, quantity: 1 }], customer: { name: "س" }, cart_token: "a".repeat(20), host: "evil.com", ip: "1.1.1.1", status: "delivered" }));

    expect(response.status).toBe(201);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://laravel.test/api/v1/public/store/orders");
    expect((init.headers as Headers).get("X-Internal-Key")).toBe("internal-key");
    expect(JSON.parse(init.body)).toEqual({ items: [{ product_id: 1, quantity: 1 }], customer: { name: "س" }, cart_token: "a".repeat(20), host: "shop.example.com", ip: "41.1.2.3", user_agent: "phone" });
  });

  it("refuses a body that is not a cart, and relays Laravel's validation errors", async () => {
    expect((await quote(post("/api/public/store/quote", { items: "x" }))).status).toBe(400);
    fetchMock.mockResolvedValueOnce(Response.json({ errors: { "items.0.quantity": ["خلص"] } }, { status: 422 }));
    const response = await quote(post("/api/public/store/quote", { items: [{ product_id: 1, quantity: 9 }] }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ errors: { "items.0.quantity": ["خلص"] } });
  });
});
