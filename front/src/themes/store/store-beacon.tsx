"use client";

import { useEffect } from "react";
import { sendStoreEvent, type StoreEventType } from "@/lib/store/events";
import { track, type TrackPayload } from "@/lib/tracking/track";

/** Counts a store view / product view (once per browser session) and fires the pixel event of the page. */
export function StoreBeacon({ type, onceKey, pixel }: { type: Extract<StoreEventType, "view" | "product_view">; onceKey?: string; pixel?: TrackPayload }) {
  useEffect(() => {
    sendStoreEvent(type, onceKey);
    if (pixel) {
      // Pixels load after the page is interactive: give them a moment.
      const timer = window.setTimeout(() => track("ViewContent", pixel), 1200);
      return () => window.clearTimeout(timer);
    }
  }, [type, onceKey, pixel]);
  return null;
}
