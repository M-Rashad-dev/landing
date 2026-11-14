import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Container health check (docker compose): the server is up. */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
