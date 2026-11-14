import type { Session } from "@/lib/types/session";

/** Public address of the store's primary host (production: https, no port). */
export function storeUrl(session: Pick<Session, "primary_host" | "public_origin">): string | null {
  if (!session.primary_host) return null;
  const { scheme, port } = session.public_origin;
  return `${scheme}://${session.primary_host}${port ? `:${port}` : ""}`;
}
