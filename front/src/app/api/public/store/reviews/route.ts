import { badRequest, relayPublic, visitorHost } from "@/lib/public/visitor";

export const dynamic = "force-dynamic";

/** The visible reviews of a product, a page at a time (the first page comes with the product page). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("slug") ?? "";
  const page = params.get("page") ?? "1";
  if (!slug || slug.length > 200 || !/^\d{1,4}$/.test(page)) return badRequest();
  const query = new URLSearchParams({ host: visitorHost(request), page });
  return relayPublic(`/public/store/products/${encodeURIComponent(slug)}/reviews?${query.toString()}`);
}
