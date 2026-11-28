import { badRequest, relayPublic, visitorHost } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** «قارن»: the visitor's products (≤ 4 ids from their browser) with their spec rows. */
export async function GET(request: Request) {
  const ids = new URL(request.url).searchParams.get("ids") ?? "";
  if (!/^[1-9]\d{0,9}(,[1-9]\d{0,9}){0,3}$/.test(ids)) return badRequest();
  const query = new URLSearchParams({ host: visitorHost(request), ids });
  return relayPublic(`/public/store/compare?${query.toString()}`);
}
