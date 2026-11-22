import { NextResponse, type NextRequest } from "next/server";
import { laravelFetch } from "@/lib/api/server";

export const dynamic = "force-dynamic";

/** A carrier posts one shipment update at a time; anything bigger is not a carrier. */
const MAX_BODY_BYTES = 64 * 1024;

type Context = { params: Promise<{ carrier: string; token: string }> };

/**
 * A shipping carrier's status updates (https://{APP_HOST}/api/webhooks/shipping/{carrier}/{token}). Laravel isn't on
 * the internet, so this relays them with the internal key; the carrier's Authorization header (the secret we gave it
 * for this store) goes as X-Carrier-Auth, and Laravel checks it.
 */
export async function POST(request: NextRequest, context: Context) {
  const { carrier, token } = await context.params;
  if (!/^[a-z0-9_]{2,30}$/.test(carrier) || !/^[a-z0-9]{40}$/.test(token)) return new NextResponse("", { status: 404 });
  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY_BYTES) return new NextResponse("", { status: 400 });

  try {
    const upstream = await laravelFetch(`/webhooks/shipping/${carrier}/${token}`, {
      auth: false,
      internal: true,
      method: "POST",
      body: raw,
      headers: { "Content-Type": "application/json", "X-Carrier-Auth": request.headers.get("authorization") ?? "" },
    });
    // Carriers retry anything that isn't 2xx: only a wrong token or secret answers otherwise.
    return new NextResponse("", { status: upstream.ok ? 200 : upstream.status === 403 || upstream.status === 404 ? upstream.status : 500 });
  } catch {
    return new NextResponse("", { status: 503 });
  }
}
