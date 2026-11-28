import { badRequest, pickKeys, relayPublic, visitorBody, visitorHost, visitorIp } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** «اسأل سؤال» on a product page: kept for the merchant to answer (docs/plans/tekno/PLAN.md §3). */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!body || !slug || slug.length > 200) return badRequest();
  return relayPublic(`/public/store/products/${encodeURIComponent(slug)}/questions`, {
    method: "POST",
    body: { ...pickKeys(body, ["name", "phone", "question", "form_token", "website"]), host: visitorHost(request), ip: visitorIp(request) },
  });
}
