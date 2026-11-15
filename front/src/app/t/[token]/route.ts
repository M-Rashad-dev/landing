import { NextResponse } from "next/server";
import { laravelFetch } from "@/lib/api/server";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * The short link in order messages (https://{PLATFORM_DOMAIN}/t/{token}): one fixed domain for
 * every store (Meta's templates need it), sent on to the order's store tracking page.
 * An unknown link lands on the platform home.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const env = serverEnv();
  const home = `${env.publicScheme}://${env.platformDomain}${env.publicPort ? `:${env.publicPort}` : ""}/`;
  if (!/^[a-z0-9]{12}$/.test(token)) return NextResponse.redirect(home, 302);

  try {
    const response = await laravelFetch(`/public/track-link?token=${token}`, { auth: false, internal: true });
    if (response.ok) {
      const json = (await response.json()) as { data?: { url?: string } };
      const url = json.data?.url;
      if (url && /^https?:\/\//.test(url)) return NextResponse.redirect(url, 302);
    }
  } catch {
    // Laravel down: the platform home is the least bad answer.
  }
  return NextResponse.redirect(home, 302);
}
