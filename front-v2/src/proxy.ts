import { NextResponse, type NextRequest } from "next/server";
import { TOKEN_COOKIE } from "@/lib/auth/cookie";

/** Pages that need a signed-in user, and the sign-in pages a signed-in user skips. */
const PROTECTED = ["/dashboard", "/admin"];
const AUTH_PAGES = ["/login", "/register"];

const matches = (pathname: string, prefixes: readonly string[]) => prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Next 16 "proxy" (formerly middleware). Only a fast cookie check: the real check is
 * /auth/me in the layouts (an expired token goes through /api/auth/expired, which clears it).
 * Host routing for store sites comes with the storefront part (HANDOFF.md).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);

  if (pathname === "/") return NextResponse.redirect(new URL(hasToken ? "/dashboard" : "/login", request.url));

  if (matches(pathname, PROTECTED) && !hasToken) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (matches(pathname, AUTH_PAGES) && hasToken) return NextResponse.redirect(new URL("/dashboard", request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
