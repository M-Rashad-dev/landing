import { badRequest, pickKeys, relayPublic, visitorBody, visitorHost } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** A finished «اختبار البشرة»: counts its result for the merchant (no personal data). */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relayPublic("/public/store/quiz", { method: "POST", body: { ...pickKeys(body, ["section_id", "result_id"]), host: visitorHost(request) } });
}
