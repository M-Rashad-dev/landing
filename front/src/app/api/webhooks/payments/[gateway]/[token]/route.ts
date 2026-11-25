import { NextResponse, type NextRequest } from "next/server";
import { laravelFetch } from "@/lib/api/server";

export const dynamic = "force-dynamic";

/** One payment event; anything bigger is not a gateway. */
const MAX_BODY_BYTES = 512 * 1024;
/** Signature headers the gateways send (Paymob signs in the query string instead). */
const SIGNATURES = ["xpay-signature", "stripe-signature", "x-kashier-signature"];

/**
 * A store's own gateway webhook (https://{APP_HOST}/api/webhooks/payments/{gateway}/{token}: Paymob, Kashier, XPay, Stripe).
 * Laravel isn't on the internet, so this relays it with the internal key: the raw body, the query string and the
 * signature headers untouched (Laravel checks each gateway's signature on those exact bytes).
 */
export async function POST(request: NextRequest, context: { params: Promise<{ gateway: string; token: string }> }) {
  const { gateway, token } = await context.params;
  if (!/^[a-z0-9_]{2,20}$/.test(gateway) || !/^[a-z0-9]{40}$/.test(token)) return new NextResponse("", { status: 404 });
  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY_BYTES) return new NextResponse("", { status: 400 });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  for (const name of SIGNATURES) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }

  try {
    const upstream = await laravelFetch(`/webhooks/payments/${gateway}/${token}${request.nextUrl.search}`, { auth: false, internal: true, method: "POST", body: raw, headers });
    // Gateways retry anything that isn't 2xx: a refused signature answers 403, a failure 500 (retried).
    return new NextResponse("", { status: upstream.status === 403 ? 403 : upstream.ok ? 200 : 500 });
  } catch {
    return new NextResponse("", { status: 503 });
  }
}
