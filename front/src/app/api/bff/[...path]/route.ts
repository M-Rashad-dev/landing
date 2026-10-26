import { NextResponse, type NextRequest } from "next/server";
import { clearTokenCookie, isSecureRequest, TOKEN_COOKIE } from "@/lib/auth/cookie";
import { serverEnv } from "@/lib/env";
import { forbiddenOrigin, jsonError, upstreamUnavailable } from "@/lib/http/json";
import { forwardedHeaders, isSafeMethod, isSameOrigin } from "@/lib/http/request";

/** Laravel route groups the dashboard may reach through the BFF. */
const ALLOWED_ROOTS = new Set(["dashboard", "admin", "auth"]);
const ALLOWED_AUTH = new Set(["me"]);

/** Response headers passed back to the browser. */
const PASS_HEADERS = ["content-type", "content-disposition", "retry-after", "cache-control"];

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: Context): Promise<NextResponse> {
  const { path } = await context.params;

  if (!path.length || !ALLOWED_ROOTS.has(path[0]) || (path[0] === "auth" && !ALLOWED_AUTH.has(path[1] ?? ""))) {
    return jsonError(404, "not_found");
  }
  if (path.some((segment) => segment === ".." || segment === "." || segment === "")) {
    return jsonError(404, "not_found");
  }
  if (!isSafeMethod(request.method) && !isSameOrigin(request)) {
    return forbiddenOrigin();
  }

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    const response = jsonError(401, "unauthenticated");
    return response;
  }

  const env = serverEnv();
  const target = `${env.laravelUrl}/api/v1/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...forwardedHeaders(request),
  });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const contentLength = request.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  const hasBody = !isSafeMethod(request.method) && request.body !== null;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      // Stream the body (JSON or multipart) without buffering it in memory.
      body: hasBody ? request.body : undefined,
      cache: "no-store",
      redirect: "manual",
      ...(hasBody ? { duplex: "half" } : {}),
    } as RequestInit);
  } catch {
    return upstreamUnavailable();
  }

  const responseHeaders = new Headers();
  for (const name of PASS_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  const response = new NextResponse(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });

  if (upstream.status === 401) clearTokenCookie(response, isSecureRequest(request));

  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
