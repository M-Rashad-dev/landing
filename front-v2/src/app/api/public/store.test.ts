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
  it("draws a store host from /sites/{host}, keeping the path for redirects", async () => {
    const response = await proxy(visit("shop.example.com", "/products/shirt?x=1"));
    expect(rewrittenTo(response)).toBe("http://shop.example.com/sites/shop.example.com/products/shirt?x=1");
    expect(response.headers.get("x-middleware-request-x-site-path")).toBe("/products/shirt?x=1");
    expect(rewrittenTo(await proxy(visit("shop.example.com", "/")))).toBe("http://shop.example.com/sites/shop.example.com");
  });

  it("keeps the dashboard and other stores' paths off a store host", async () => {
    expect(rewrittenTo(await proxy(visit("shop.example.com", "/dashboard")))).toContain("/__not-found");
    expect(rewrittenTo(await proxy(visit("shop.example.com", "/sites/other.com")))).toContain("/__not-found");
    expect(rewrittenTo(await proxy(visit("shop.example.com", "/api/bff/dashboard/orders")))).toContain("/__not-found");
    expect(rewrittenTo(await proxy(visit("shop.example.com", "/api/public/store/quote")))).toBeNull();
  });

  it("shows the marketing page on the platform domain only, never at /platform itself", async () => {
    expect(rewrittenTo(await proxy(visit("maksab.test", "/")))).toBe("http://maksab.test/platform");
    expect(rewrittenTo(await proxy(visit("www.maksab.test", "/")))).toBe("http://www.maksab.test/platform");
    expect(rewrittenTo(await proxy(visit("maksab.test", "/platform")))).toContain("/__not-found");
    expect(rewrittenTo(await proxy(visit("app.maksab.test", "/platform")))).toContain("/__not-found");
    expect((await proxy(visit("app.maksab.test", "/"))).headers.get("location")).toContain("/login");
  });

  it("keeps store pages off the app host", async () => {
    expect(rewrittenTo(await proxy(visit("app.maksab.test", "/sites/shop.example.com")))).toContain("/__not-found");
    expect(rewrittenTo(await proxy(visit("app.maksab.test", "/products")))).toContain("/__not-found");
    expect((await proxy(visit("app.maksab.test", "/dashboard"))).headers.get("location")).toContain("/login?next=%2Fdashboard");
  });
});

describe("A/B tests", () => {
  const routes = { data: [{ id: 7, entries: ["offer"], a: "offer", b: "offer-b", split_a: 50 }] };

  it("shows page A or B under A's link and keeps the visitor on the same one", async () => {
    fetchMock.mockResolvedValue(Response.json(routes));
    const toB = await proxy(visit("ab.example.com", "/offer", "lp_ab_7=b"));
    expect(rewrittenTo(toB)).toBe("http://ab.example.com/sites/ab.example.com/offer-b");
    expect(toB.cookies.get("lp_abt")?.value).toBe("7");
    expect(rewrittenTo(await proxy(visit("ab.example.com", "/offer", "lp_ab_7=a")))).toBe("http://ab.example.com/sites/ab.example.com/offer");
    // The test list is cached per host, and other links (and the store home) are left alone.
    expect(rewrittenTo(await proxy(visit("ab.example.com", "/other")))).toBe("http://ab.example.com/sites/ab.example.com/other");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://laravel.test/api/v1/public/ab-routes?host=ab.example.com");
  });

  it("sends everyone to B once B won, and serves the page when Laravel is down", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [{ ...routes.data[0], split_a: 0 }] }));
    expect(rewrittenTo(await proxy(visit("won.example.com", "/offer", "lp_ab_7=a")))).toBe("http://won.example.com/sites/won.example.com/offer-b");
    fetchMock.mockRejectedValueOnce(new Error("down"));
    expect(rewrittenTo(await proxy(visit("down.example.com", "/offer")))).toBe("http://down.example.com/sites/down.example.com/offer");
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
