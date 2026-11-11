import type { NextRequest, NextResponse } from "next/server";

export const TOKEN_COOKIE = "lp_token";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

/** Secure whenever the visitor is on https (always in production behind Caddy). */
export function isSecureRequest(request: NextRequest | Request): boolean {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return new URL(request.url).protocol === "https:";
}

export function setTokenCookie(response: NextResponse, token: string, secure: boolean): void {
  response.cookies.set({
    name: TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export function clearTokenCookie(response: NextResponse, secure: boolean): void {
  response.cookies.set({
    name: TOKEN_COOKIE,
    value: "",
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
