import { laravelFetch } from "@/lib/api/server";
import { jsonError, upstreamUnavailable } from "@/lib/http/json";
import { visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

const PASS = ["content-type", "content-disposition", "content-length", "x-content-type-options"];

/** A buyer's file (the delivery's private token), streamed from Laravel as it comes (up to 100 MB, never buffered). */
export async function GET(request: Request, { params }: { params: Promise<{ token: string; file: string }> }) {
  const { token, file } = await params;
  if (!/^[a-z0-9]{40}$/.test(token) || !/^\d{1,10}$/.test(file)) return jsonError(404, "not_found");
  const query = new URLSearchParams({ host: visitorHost(request) });
  const ip = visitorIp(request);
  if (ip) query.set("ip", ip);
  let response: Response;
  try {
    response = await laravelFetch(`/public/deliveries/${token}/files/${file}?${query}`, { auth: false, internal: true });
  } catch {
    return upstreamUnavailable();
  }
  if (!response.ok) {
    // Used up or gone: a page the customer can read, not a broken download.
    const json = (await response.json().catch(() => ({}))) as { message?: string };
    return new Response(page(json.message ?? "الملف ده مش متاح."), { status: response.status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  for (const name of PASS) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(response.body, { status: 200, headers });
}

function page(message: string): string {
  const safe = message.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe}</title></head><body style="font-family:system-ui,Tahoma,sans-serif;background:#f5f5f5;display:grid;place-items:center;min-height:100vh;margin:0"><p style="background:#fff;padding:24px;border-radius:16px;max-width:420px;text-align:center;line-height:1.8">${safe}</p></body></html>`;
}
