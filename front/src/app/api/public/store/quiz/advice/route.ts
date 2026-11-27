import { badRequest, pickKeys, relayPublic, visitorBody, visitorHost } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** «اختبار البشرة» with AI: the answers (and her own words) give a result and the store's products. */
export async function POST(request: Request) {
  const body = await visitorBody(request);
  if (!body) return badRequest();
  return relayPublic("/public/store/quiz/advice", { method: "POST", body: { ...pickKeys(body, ["section_id", "answers", "note"]), host: visitorHost(request) } });
}
