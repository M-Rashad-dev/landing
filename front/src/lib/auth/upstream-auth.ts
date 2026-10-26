import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { forbiddenOrigin, upstreamUnavailable } from "@/lib/http/json";
import { forwardedHeaders, isSameOrigin } from "@/lib/http/request";
import { isSecureRequest, setTokenCookie } from "./cookie";

/**
 * Shared flow for /api/auth/login and /api/auth/register:
 * forward the JSON body to Laravel, keep the token in an httpOnly cookie,
 * and never expose the token to the browser.
 */
export async function forwardAuth(request: NextRequest, laravelPath: "/auth/login" | "/auth/register"): Promise<NextResponse> {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const env = serverEnv();
  const body = await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${env.laravelUrl}/api/v1${laravelPath}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...forwardedHeaders(request) },
      body,
      cache: "no-store",
    });
  } catch {
    return upstreamUnavailable();
  }

  const json = (await upstream.json().catch(() => ({}))) as {
    data?: { token?: string; [key: string]: unknown };
    [key: string]: unknown;
  };

  if (!upstream.ok || !json.data?.token) {
    return NextResponse.json(json, { status: upstream.ok ? 502 : upstream.status, headers: retryAfter(upstream) });
  }

  const { token, ...rest } = json.data;
  const response = NextResponse.json({ data: rest }, { status: upstream.status });
  setTokenCookie(response, token, isSecureRequest(request));

  return response;
}

function retryAfter(upstream: Response): HeadersInit | undefined {
  const value = upstream.headers.get("retry-after");
  return value ? { "Retry-After": value } : undefined;
}
