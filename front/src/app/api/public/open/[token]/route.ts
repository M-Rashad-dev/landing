import { NextResponse } from "next/server";
import { laravelFetch } from "@/lib/api/server";
import { jsonError, upstreamUnavailable } from "@/lib/http/json";
import { visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** A buyer opens his link: counted by Laravel, then sent on to it (a readable page once used up). */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-z0-9]{40}$/.test(token)) return jsonError(404, "not_found");
  let response: Response;
  try {
    response = await laravelFetch(`/public/deliveries/${token}/open`, { auth: false, internal: true, method: "POST", body: { host: visitorHost(request), ip: visitorIp(request) } });
  } catch {
    return upstreamUnavailable();
  }
  const json = (await response.json().catch(() => ({}))) as { data?: { url?: string }; message?: string };
  const url = json.data?.url;
  if (response.ok && url && /^https?:\/\//.test(url)) return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  const message = (json.message ?? "الرابط ده مش متاح.").replace(/[<>&"]/g, "");
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${message}</title></head><body style="font-family:system-ui,Tahoma,sans-serif;background:#f5f5f5;display:grid;place-items:center;min-height:100vh;margin:0"><p style="background:#fff;padding:24px;border-radius:16px;max-width:420px;text-align:center;line-height:1.8">${message}</p></body></html>`, { status: response.status === 200 ? 404 : response.status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
