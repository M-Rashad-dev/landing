import { NextResponse, type NextRequest } from "next/server";
import { AB_COOKIE_MAX_AGE, matchRoute, pickVariant, routesForHost, VARIANT_COOKIE } from "@/lib/ab/split";
import { TOKEN_COOKIE } from "@/lib/auth/cookie";
import { AB_TEST_COOKIE } from "@/lib/tracking/visit";
import {
  APP_ALLOWED_PREFIXES,
  APP_ONLY_PREFIXES,
  classifyHost,
  LEGAL_PATHS,
  matchesPrefix,
  normalizeHost,
} from "@/lib/host/classify";

/**
 * Host routing (Next 16 "proxy", formerly middleware):
 * - PLATFORM_DOMAIN → marketing page
 * - APP_HOST        → dashboard / admin / preview / api only
 * - any other host  → tenant public site, rewritten to /sites/{host}{path}
 *   (folder is "sites" because Next treats "_folders" as private; it is only
 *   reachable through this rewrite, every other host 404s on /sites).
 */
export async function proxy(request: NextRequest) {
  const config = {
    platformDomain: (process.env.PLATFORM_DOMAIN ?? "localhost").toLowerCase(),
    appHost: (process.env.APP_HOST ?? "app.localhost").toLowerCase(),
  };
  const rawHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const host = normalizeHost(rawHost);
  const kind = classifyHost(host, config);
  const { pathname } = request.nextUrl;

  // Machine endpoints (secret-protected / health) answer on any host, including front:3000.
  if (pathname === "/api/revalidate" || pathname === "/api/health") return NextResponse.next();
  // Uploaded images (Caddy serves them in production; the dev fallback route proxies Laravel).
  if (pathname.startsWith("/media/")) return NextResponse.next();

  if (kind === "app") return handleAppHost(request, pathname);

  if (kind === "platform") {
    if (pathname === "/" || LEGAL_PATHS.includes(pathname)) return NextResponse.next();
    if (matchesPrefix(pathname, APP_ONLY_PREFIXES)) {
      const url = new URL(request.nextUrl.toString());
      url.host = config.appHost;
      url.port = request.nextUrl.port;
      return NextResponse.redirect(url);
    }
    return notFound(request);
  }

  // Tenant host: block every app-only path, rewrite the rest to the public renderer.
  if (matchesPrefix(pathname, APP_ONLY_PREFIXES)) return notFound(request);
  if (pathname.startsWith("/api/")) {
    // Visitors may reach the public form endpoints only.
    if (matchesPrefix(pathname, ["/api/public"])) return NextResponse.next();
    return notFound(request);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/sites/${encodeURIComponent(host)}${pathname === "/" ? "" : pathname}`;

  // A/B test on this link: page A or B under the same URL, kept per visitor (cookie).
  const route = request.method === "GET" ? matchRoute(await routesForHost(host), pathname) : null;
  if (!route) return NextResponse.rewrite(url);
  const variant = pickVariant(route, request.cookies.get(VARIANT_COOKIE(route.id))?.value);
  if (variant === "b") url.pathname = `/sites/${encodeURIComponent(host)}/${encodeURIComponent(route.b)}`;
  const response = NextResponse.rewrite(url);
  const cookie = { path: "/", maxAge: AB_COOKIE_MAX_AGE, sameSite: "lax" as const };
  response.cookies.set(VARIANT_COOKIE(route.id), variant, cookie);
  response.cookies.set(AB_TEST_COOKIE, String(route.id), cookie);
  return response;
}

function handleAppHost(request: NextRequest, pathname: string) {
  const hasToken = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);

  if (pathname === "/") return redirectTo(request, hasToken ? "/dashboard" : "/login");

  if (!matchesPrefix(pathname, APP_ALLOWED_PREFIXES)) return notFound(request);

  const isAuthPage = matchesPrefix(pathname, ["/login", "/register"]);
  const isProtected = matchesPrefix(pathname, ["/dashboard", "/admin", "/preview"]);

  if (isProtected && !hasToken) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (isAuthPage && hasToken) return redirectTo(request, "/dashboard");

  return NextResponse.next();
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

function notFound(request: NextRequest) {
  const url = request.nextUrl.clone();
  // A path with no route renders app/not-found.tsx with a 404 status.
  url.pathname = "/__not-found";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
