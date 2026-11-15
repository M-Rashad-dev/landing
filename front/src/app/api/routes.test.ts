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

describe("/api/webhooks/whatsapp", () => {
  it("relays Meta's subscribe check and answers the challenge as text", async () => {
    const { GET } = await import("./webhooks/whatsapp/route");
    fetchMock.mockResolvedValueOnce(new Response("98765", { status: 200 }));
    const response = await GET(request("/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=v&hub.challenge=98765", { origin: null }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("98765");
    expect(fetchMock.mock.calls[0][0]).toBe("http://laravel.test/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=v&hub.challenge=98765");
  });

  it("forwards the raw body and Meta's signature untouched", async () => {
    const { POST } = await import("./webhooks/whatsapp/route");
    fetchMock.mockResolvedValueOnce(Response.json({ ok: true }));
    const raw = '{"entry":[{"changes":[]}],"x":"é"}';
    const req = new NextRequest(`${ORIGIN}/api/webhooks/whatsapp`, { method: "POST", headers: { host: "app.localhost:3200", "x-hub-signature-256": "sha256=abc" }, body: raw });
    const response = await POST(req);
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://laravel.test/api/v1/webhooks/whatsapp");
    expect(init.body).toBe(raw);
    const headers = new Headers(init.headers);
    expect(headers.get("x-hub-signature-256")).toBe("sha256=abc");
    expect(headers.get("x-internal-key")).not.toBeNull();
  });

  it("answers 403 when Laravel refuses the signature", async () => {
    const { POST } = await import("./webhooks/whatsapp/route");
    fetchMock.mockResolvedValueOnce(Response.json({ code: "forbidden" }, { status: 403 }));
    const req = new NextRequest(`${ORIGIN}/api/webhooks/whatsapp`, { method: "POST", headers: { host: "app.localhost:3200" }, body: "{}" });
    expect((await POST(req)).status).toBe(403);
  });
});

describe("/api/auth/password/*", () => {
  it("forwards the forgot-password request and relays the answer", async () => {
    const { POST } = await import("./auth/password/code/route");
    fetchMock.mockResolvedValueOnce(Response.json({ data: { channel: "whatsapp", code: null } }));
    const response = await POST(request("/api/auth/password/code", { method: "POST", body: { login: "a@b.c" } }));
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("http://laravel.test/api/v1/auth/password/code");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("relays 204 on reset and refuses another site", async () => {
    const { POST } = await import("./auth/password/reset/route");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect((await POST(request("/api/auth/password/reset", { method: "POST", body: {} }))).status).toBe(204);
    expect((await POST(request("/api/auth/password/reset", { method: "POST", body: {}, origin: "https://evil.example" }))).status).toBe(403);
  });
});

describe("/t/[token]", () => {
  const params = (token: string) => ({ params: Promise.resolve({ token }) });

  it("sends the order's short link on to its store tracking page", async () => {
    process.env.PLATFORM_DOMAIN = "platform.test";
    const { GET } = await import("../t/[token]/route");
    fetchMock.mockResolvedValueOnce(Response.json({ data: { url: "https://habba.platform.test/track?t=k3x9q2abcdef" } }));

    const response = await GET(new Request("https://platform.test/t/k3x9q2abcdef"), params("k3x9q2abcdef"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://habba.platform.test/track?t=k3x9q2abcdef");
    expect(fetchMock.mock.calls[0][0]).toBe("http://laravel.test/api/v1/public/track-link?token=k3x9q2abcdef");
  });

  it("lands on the platform home for an unknown or malformed link", async () => {
    process.env.PLATFORM_DOMAIN = "platform.test";
    const { GET } = await import("../t/[token]/route");
    fetchMock.mockResolvedValueOnce(Response.json({ code: "order_not_found" }, { status: 404 }));

    expect((await GET(new Request("https://platform.test/t/aaaaaaaaaaaa"), params("aaaaaaaaaaaa"))).headers.get("location")).toBe("https://platform.test/");
    expect((await GET(new Request("https://platform.test/t/BAD"), params("BAD"))).headers.get("location")).toBe("https://platform.test/");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
