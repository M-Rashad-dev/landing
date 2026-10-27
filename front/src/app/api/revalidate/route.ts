import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { parseTags, secretMatches } from "@/lib/public/revalidate";

export const dynamic = "force-dynamic";

/** Called by Laravel (FrontendRevalidator) after publish/edits: purges the cached data of the given host tags. */
export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-revalidate-secret"), serverEnv().revalidateSecret)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const tags = parseTags(await request.json().catch(() => null));
  if (!tags) return NextResponse.json({ message: "tags must be 1-50 strings" }, { status: 422 });

  // Expire now: the next visit renders fresh data instead of serving the stale copy once more.
  for (const tag of tags) revalidateTag(tag, { expire: 0 });

  return NextResponse.json({ revalidated: tags.length });
}
