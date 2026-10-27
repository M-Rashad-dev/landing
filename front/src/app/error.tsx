"use client";

import { siteMessages } from "@/messages/site";

/** Platform pages outside the dashboard (marketing, login, register). */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main dir="rtl" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <h1 className="text-2xl font-bold">{siteMessages.errorTitle}</h1>
      <p className="max-w-md text-muted-foreground">{siteMessages.errorText}</p>
      <button type="button" onClick={reset} className="mt-2 rounded-lg border px-5 py-2.5 font-semibold hover:bg-accent">
        {siteMessages.retry}
      </button>
    </main>
  );
}
