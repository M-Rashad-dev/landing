import { NextResponse, type NextRequest } from "next/server";
import { laravelFetch } from "@/lib/api/server";

export const dynamic = "force-dynamic";

/** Meta posts a batch of message updates at a time; anything bigger is not Meta. */
const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Meta's WhatsApp webhook (https://{APP_HOST}/api/webhooks/whatsapp). Laravel isn't on the
 * internet, so this relays it with the internal key: the subscribe check as is, and posts with the
 * raw body and Meta's signature untouched (Laravel checks the signature on those exact bytes).
 */
export async function GET(request: NextRequest) {
  try {
    const upstream = await laravelFetch(`/webhooks/whatsapp${request.nextUrl.search}`, { auth: false, internal: true });
    const text = await upstream.text();
    return new NextResponse(upstream.ok ? text : "", { status: upstream.ok ? 200 : 403, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  } catch {
    return new NextResponse("", { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY_BYTES) return new NextResponse("", { status: 400 });

  try {
    const upstream = await laravelFetch("/webhooks/whatsapp", {
      auth: false,
      internal: true,
      method: "POST",
      body: raw,
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": request.headers.get("x-hub-signature-256") ?? "" },
    });
    // Meta retries anything that isn't 200 for days: only a refused signature answers otherwise.
    return new NextResponse("", { status: upstream.status === 403 ? 403 : upstream.ok ? 200 : 500 });
  } catch {
    return new NextResponse("", { status: 503 });
  }
}
