"use client";

import Script from "next/script";
import { Fragment } from "react";
import { validTracking, type Tracking } from "./ids";
import { PIXEL_KEYS, pixelSnippet, pixelSrc } from "./snippets";

/** The merchant's pixels (only ids that pass the format check), loaded after the page is interactive. */
export function TrackingScripts({ tracking }: { tracking: Tracking | null | undefined }) {
  const ids = validTracking(tracking);
  const enabled = PIXEL_KEYS.filter((key) => ids[key]);
  if (enabled.length === 0) return null;

  return (
    <>
      {enabled.map((key) => {
        const id = ids[key]!;
        const src = pixelSrc(key, id);
        return (
          <Fragment key={key}>
            {src ? <Script id={`as-${key}-lib`} src={src} strategy="afterInteractive" /> : null}
            <Script id={`as-${key}`} strategy="afterInteractive">
              {pixelSnippet(key, id)}
            </Script>
          </Fragment>
        );
      })}
    </>
  );
}
