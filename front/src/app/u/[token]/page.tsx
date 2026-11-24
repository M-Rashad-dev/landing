import type { Metadata } from "next";
import { laravelFetch } from "@/lib/api/server";
import { ar } from "@/messages/ar";

export const dynamic = "force-dynamic";

const t = ar.storefront.unsubscribe;

export const metadata: Metadata = { title: t.title, robots: { index: false, follow: false } };

/**
 * «مش عايز تذكيرات تاني» from a cart reminder email (https://{PLATFORM_DOMAIN}/u/{token}). Opening the link only
 * asks; the button confirms (mail scanners open links, they don't press buttons).
 */
export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const { done } = await searchParams;

  async function unsubscribe() {
    "use server";
    const { redirect } = await import("next/navigation");
    let ok = false;
    try {
      const response = await laravelFetch("/public/recovery/unsubscribe", { auth: false, internal: true, method: "POST", body: { token } });
      ok = response.ok;
    } catch {
      ok = false;
    }
    redirect(`/u/${token}?done=${ok ? "1" : "0"}`);
  }

  const valid = /^[a-f0-9]{24}$/.test(token);
  return (
    <main dir="rtl" className="flex min-h-dvh items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
        <h1 className="font-display text-lg font-semibold">{done === "1" ? t.doneTitle : t.title}</h1>
        <p className="mt-2 text-sm text-ink-2">{!valid || done === "0" ? t.invalid : done === "1" ? t.doneText : t.text}</p>
        {valid && done === undefined ? (
          <form action={unsubscribe} className="mt-5">
            <button type="submit" className="h-10 w-full rounded-lg bg-ink px-4 text-sm font-semibold text-white">
              {t.confirm}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
