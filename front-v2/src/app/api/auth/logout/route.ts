import { NextResponse, type NextRequest } from "next/server";
import { clearTokenCookie, isSecureRequest, TOKEN_COOKIE } from "@/lib/auth/cookie";
import { serverEnv } from "@/lib/env";
import { forbiddenOrigin } from "@/lib/http/json";
import { isSameOrigin } from "@/lib/http/request";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (token) {
    const env = serverEnv();
    // Best effort: the cookie is cleared even if Laravel is unreachable.
    await fetch(`${env.laravelUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => undefined);
  }

  const response = new NextResponse(null, { status: 204 });
  clearTokenCookie(response, isSecureRequest(request));
  return response;
}
