import { NextResponse, type NextRequest } from "next/server";
import { clearTokenCookie, isSecureRequest } from "@/lib/auth/cookie";

/**
 * Server Components cannot delete cookies, so when Laravel rejects the token
 * they redirect here: the stale cookie is cleared and the user goes to /login.
 */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const url = new URL("/login", request.url);
  if (next && next.startsWith("/") && !next.startsWith("//")) url.searchParams.set("next", next);

  const response = NextResponse.redirect(url);
  clearTokenCookie(response, isSecureRequest(request));
  return response;
}
