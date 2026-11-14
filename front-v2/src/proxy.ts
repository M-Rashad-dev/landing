import { NextResponse, type NextRequest } from "next/server";
import { AB_TEST_COOKIE } from "@/lib/ab/cookie";
import { AB_COOKIE_MAX_AGE, matchRoute, pickVariant, routesForHost, VARIANT_COOKIE } from "@/lib/ab/split";
import { TOKEN_COOKIE } from "@/lib/auth/cookie";
import { APP_ALLOWED_PREFIXES, APP_ONLY_PREFIXES, classifyHost, matchesPrefix, STORE_API_PREFIXES } from "@/lib/host/classify";
import { requestHost } from "@/lib/http/request";
import { SITE_PATH_HEADER } from "@/lib/public/host";

/**
 * Host routing (Next 16 "proxy", formerly middleware). Only fast checks: the real session check is
 * /auth/me in the layouts.
 * - APP_HOST        → dashboard, admin, sign-in, api
 * - PLATFORM_DOMAIN → the marketing home page at "/" (drawn from /platform, reachable only this way); other paths as the app host
 * - any other host  → that store, rewritten to /sites/{host}{path} (reachable only through this rewrite);
 *   a landing page link under an A/B test shows page A or page B, kept per visitor in a cookie
 */
export async function proxy(request: NextRequest) {
  const config = {
    platformDomain: (process.env.PLATFORM_DOMAIN ?? "localhost").toLowerCase(),
    appHost: (process.env.APP_HOST ?? "app.localhost").toLowerCase(),
  };
  const host = requestHost(request);
  const kind = classifyHost(host, config);
  const { pathname, search } = request.nextUrl;

  // Machine endpoint (secret-protected) and uploaded images answer on any host.
  if (pathname === "/api/revalidate" || pathname.startsWith("/media/")) return NextResponse.next();

  if (kind === "platform" && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/platform";
    return NextResponse.rewrite(url);
  }
  if (kind !== "tenant") return appHost(request, pathname, search);

  // A store host: app pages do not exist here; the visitor endpoints do.
  if (matchesPrefix(pathname, APP_ONLY_PREFIXES) || pathname.startsWith("/sites/")) return notFound(request);
  if (pathname.startsWith("/api/")) return matchesPrefix(pathname, STORE_API_PREFIXES) ? NextResponse.next() : notFound(request);

  const url = request.nextUrl.clone();
  url.pathname = `/sites/${encodeURIComponent(host)}${pathname === "/" ? "" : pathname}`;
  const headers = new Headers(request.headers);
  headers.set(SITE_PATH_HEADER, pathname + search);

  const route = request.method === "GET" ? matchRoute(await routesForHost(host), pathname) : null;
  if (!route) return NextResponse.rewrite(url, { request: { headers } });
  const variant = pickVariant(route, request.cookies.get(VARIANT_COOKIE(route.id))?.value);
  if (variant === "b") url.pathname = `/sites/${encodeURIComponent(host)}/${encodeURIComponent(route.b)}`;
  const response = NextResponse.rewrite(url, { request: { headers } });
  const cookie = { path: "/", maxAge: AB_COOKIE_MAX_AGE, sameSite: "lax" as const };
  response.cookies.set(VARIANT_COOKIE(route.id), variant, cookie);
  response.cookies.set(AB_TEST_COOKIE, String(route.id), cookie);
  return response;
}

function appHost(request: NextRequest, pathname: string, search: string) {
  const hasToken = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);

  if (pathname === "/") return NextResponse.redirect(new URL(hasToken ? "/dashboard" : "/login", request.url));
  if (!matchesPrefix(pathname, APP_ALLOWED_PREFIXES)) return notFound(request);

  if (matchesPrefix(pathname, ["/dashboard", "/admin"]) && !hasToken) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (matchesPrefix(pathname, ["/login", "/register"]) && hasToken) return NextResponse.redirect(new URL("/dashboard", request.url));

  return NextResponse.next();
}

function notFound(request: NextRequest) {
  const url = request.nextUrl.clone();
  // A path with no route renders app/not-found.tsx with a 404 status.
  url.pathname = "/__not-found";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|themes/).*)"],
};
