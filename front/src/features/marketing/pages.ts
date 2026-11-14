import "server-only";
import { serverEnv } from "@/lib/env";

export type PlatformPageLink = { slug: string; title: string };
export type PlatformPage = PlatformPageLink & { summary: string | null; body: string; updated_at: string | null };

/** Purged by Laravel when the super admin saves a page (RevalidateFrontendTags), else refreshed every 5 minutes. */
const CACHE = { revalidate: 300, tags: ["platform-pages"] };

async function get<T>(path: string): Promise<T | null> {
  const env = serverEnv();
  try {
    const response = await fetch(`${env.laravelUrl}/api/v1/${path}`, { headers: { Accept: "application/json" }, next: CACHE });
    if (!response.ok) return null;
    return ((await response.json()) as { data: T }).data;
  } catch {
    return null;
  }
}

/** Published pages for the footer (empty when Laravel is unreachable). */
export async function platformPageLinks(): Promise<PlatformPageLink[]> {
  return (await get<PlatformPageLink[]>("platform-pages")) ?? [];
}

/** One published page, or null (unpublished, unknown or Laravel unreachable). */
export async function platformPage(slug: string): Promise<PlatformPage | null> {
  return get<PlatformPage>(`platform-pages/${encodeURIComponent(slug)}`);
}

/** "## Title" lines of a page, for its table of contents (ids match the rendered headings). */
export function pageHeadings(body: string): Array<{ id: string; text: string }> {
  return body
    .split("\n")
    .filter((line) => /^##\s+/.test(line))
    .map((line, i) => ({ id: `s${i + 1}`, text: line.replace(/^##\s+/, "").replace(/[*_`]/g, "").trim() }));
}
