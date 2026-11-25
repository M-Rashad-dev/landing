import { NextResponse, type NextRequest } from "next/server";
import { laravelFetch } from "@/lib/api/server";

export const dynamic = "force-dynamic";

/** One XPay event (a checkout session); anything bigger is not XPay. */
const MAX_BODY_BYTES = 512 * 1024;

/**
 * XPay's webhook (https://{APP_HOST}/api/webhooks/xpay). Laravel isn't on the internet, so this relays it with the
 * internal key: the raw body and XPay-Signature untouched (Laravel checks the HMAC on those exact bytes).
 */
export async function POST(request: NextRequest) {
  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY_BYTES) return new NextResponse("", { status: 400 });

  try {
    const upstream = await laravelFetch("/webhooks/xpay", {
      auth: false,
      internal: true,
      method: "POST",
      body: raw,
      headers: { "Content-Type": "application/json", "XPay-Signature": request.headers.get("xpay-signature") ?? "" },
    });
    // XPay retries anything that isn't 2xx: a refused signature answers 403, a failure 500 (retried).
    return new NextResponse("", { status: upstream.status === 403 ? 403 : upstream.ok ? 200 : 500 });
  } catch {
    return new NextResponse("", { status: 503 });
  }
}
