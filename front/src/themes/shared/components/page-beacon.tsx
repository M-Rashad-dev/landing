"use client";

import { useEffect } from "react";
import { sendPageEvent } from "@/lib/tracking/visit";

/** Counts the visit for the store's analytics (live pages only, never in the Builder). */
export function PageBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    sendPageEvent(slug, "view");
  }, [slug]);
  return null;
}
