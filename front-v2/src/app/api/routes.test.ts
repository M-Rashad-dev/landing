// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOKEN_COOKIE } from "@/lib/auth/cookie";
import { POST as login } from "./auth/login/route";
import { POST as logout } from "./auth/logout/route";
import { GET as bffGet, POST as bffPost } from "./bff/[...path]/route";

const ORIGIN = "http://app.localhost:3200";
const fetchMock = vi.fn();

function request(path: string, init: { method?: string; body?: unknown; origin?: string | null; token?: string } = {}) {
  const headers = new Headers({ host: "app.localhost:3200", "content-type": "application/json" });
  if (init.origin !== null) headers.set("origin", init.origin ?? ORIGIN);
  if (init.token) headers.set("cookie", `${TOKEN_COOKIE}=${init.token}`);
  return new NextRequest(`${ORIGIN}${path}`, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}

const params = (...path: string[]) => ({ params: Promise.resolve({ path }) });

beforeEach(() => {
  process.env.LARAVEL_INTERNAL_URL = "http://laravel.test";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("/api/auth/login", () => {
  it("keeps the token in an httpOnly cookie and never returns it", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { user: { id: 1, role: "owner" }, token: "secret-token" } }));
    const response = await login(request("/api/auth/login", { method: "POST", body: { login: "a@b.c", password: "x" } }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ data: { user: { id: 1, role: "owner" } } });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${TOKEN_COOKIE}=secret-token`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(fetchMock.mock.calls[0][0]).toBe("http://laravel.test/api/v1/auth/login");
  });

  it("passes Laravel errors through without a cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ message: "bad", code: "invalid_credentials" }, { status: 422 }));
    const response = await login(request("/api/auth/login", { method: "POST", body: {} }));
    expect(response.status).toBe(422);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("refuses a request from another site", async () => {
    const response = await login(request("/api/auth/login", { method: "POST", body: {}, origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 502 when Laravel is down", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("down"));
    const response = await login(request("/api/auth/login", { method: "POST", body: {} }));
    expect(response.status).toBe(502);
  });
});

describe("/api/auth/logout", () => {
  it("revokes the token and clears the cookie", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await logout(request("/api/auth/logout", { method: "POST", token: "t1" }));
    expect(response.status).toBe(204);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer t1");
    expect(response.headers.get("set-cookie")).toContain(`${TOKEN_COOKIE}=;`);
  });
});

describe("/api/bff", () => {
  it("forwards dashboard calls with the token from the cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [] }));
    const response = await bffGet(request("/api/bff/dashboard/orders?page=2", { token: "t1" }), params("dashboard", "orders"));
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("http://laravel.test/api/v1/dashboard/orders?page=2");
    expect((fetchMock.mock.calls[0][1].headers as Headers).get("Authorization")).toBe("Bearer t1");
  });

  it("answers 401 without a cookie and clears it when Laravel rejects the token", async () => {
    expect((await bffGet(request("/api/bff/dashboard/orders"), params("dashboard", "orders"))).status).toBe(401);

    fetchMock.mockResolvedValueOnce(Response.json({ message: "Unauthenticated." }, { status: 401 }));
    const response = await bffGet(request("/api/bff/dashboard/orders", { token: "old" }), params("dashboard", "orders"));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain(`${TOKEN_COOKIE}=;`);
  });

  it("reaches only the dashboard, admin and /auth/me routes", async () => {
    expect((await bffGet(request("/api/bff/public/site", { token: "t1" }), params("public", "site"))).status).toBe(404);
    expect((await bffPost(request("/api/bff/auth/login", { method: "POST", token: "t1", body: {} }), params("auth", "login"))).status).toBe(404);
    expect((await bffGet(request("/api/bff/dashboard/../admin", { token: "t1" }), params("dashboard", "..", "admin"))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a write from another site", async () => {
    const response = await bffPost(request("/api/bff/dashboard/orders", { method: "POST", token: "t1", body: {}, origin: "https://evil.example" }), params("dashboard", "orders"));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
