"use client";

import { ar } from "@/messages/ar";

/** Something failed while drawing a store page: the header and footer stay, with a retry. */
export default function StoreError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <h1 className="as-2xl font-extrabold">{ar.storefront.error.title}</h1>
      <p className="as-sm as-muted">{ar.storefront.error.text}</p>
      <button type="button" onClick={reset} className="as-btn as-sm mt-2">
        {ar.storefront.error.retry}
      </button>
    </div>
  );
}
