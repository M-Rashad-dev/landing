import { badRequest, relayPublic, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

/** «حسب الطلب»: one image / file for a product field, with the host and IP (Laravel checks the field and the file). */
export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES + 64 * 1024) return badRequest();
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const inputId = form?.get("input_id");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES || typeof inputId !== "string" || !/^\d{1,10}$/.test(inputId)) return badRequest();

  const body = new FormData();
  body.set("file", file, file.name.slice(0, 200));
  body.set("input_id", inputId);
  body.set("host", visitorHost(request));
  const ip = visitorIp(request);
  if (ip) body.set("ip", ip);
  return relayPublic("/public/uploads", { method: "POST", body });
}
