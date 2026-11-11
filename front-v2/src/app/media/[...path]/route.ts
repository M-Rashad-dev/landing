import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";

/**
 * Development fallback for /media/*: in production Caddy serves these files
 * from the media volume before the request ever reaches Next.
 */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path.some((segment) => segment === ".." || segment === "")) return new NextResponse(null, { status: 404 });

  const env = serverEnv();
  try {
    const upstream = await fetch(`${env.laravelUrl}/media/${path.map(encodeURIComponent).join("/")}`, { cache: "no-store" });
    if (!upstream.ok) return new NextResponse(null, { status: 404 });
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "public, max-age=2592000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
