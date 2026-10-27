"use client";

import { siteMessages } from "@/messages/site";

/** Visitor-facing error (Laravel unreachable, etc.). Plain styles: no theme or dashboard code. */
export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main dir="rtl" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-white px-6 text-center text-slate-900" style={{ fontFamily: "system-ui, sans-serif" }}>
      <h1 className="text-2xl font-bold">{siteMessages.errorTitle}</h1>
      <p className="max-w-md text-slate-500">{siteMessages.errorText}</p>
      <button type="button" onClick={reset} className="mt-2 rounded-lg border border-slate-300 px-5 py-2.5 font-semibold hover:bg-slate-50">
        {siteMessages.retry}
      </button>
    </main>
  );
}
