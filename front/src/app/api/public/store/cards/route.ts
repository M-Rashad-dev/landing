import { badRequest, relayPublic, visitorHost } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** «المفضلة»: product cards by id (≤ 100, from the visitor's browser), in that order. */
export async function GET(request: Request) {
  const ids = new URL(request.url).searchParams.get("ids") ?? "";
  if (ids.length > 1200 || !/^[1-9]\d{0,9}(,[1-9]\d{0,9}){0,99}$/.test(ids)) return badRequest();
  const query = new URLSearchParams({ host: visitorHost(request), ids });
  return relayPublic(`/public/store/cards?${query.toString()}`);
}
