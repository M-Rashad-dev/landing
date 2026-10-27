"use client";

import Script from "next/script";
import { Fragment, useEffect, useRef } from "react";
import { validTracking, type Tracking } from "./ids";
import { PIXEL_GLOBALS, PIXEL_KEYS, pixelSnippet, pixelSrc } from "./snippets";
import { track } from "./track";
import { captureUtm } from "./utm";

type Product = { id: number; name: string; price: number } | null;

/**
 * Injects only the valid pixel ids (afterInteractive), then sends ViewContent once
 * all loaders are ready. Nothing is rendered in preview mode.
 */
export function TrackingScripts({ tracking, product, isPreview = false }: { tracking: Tracking | null | undefined; product: Product; isPreview?: boolean }) {
  const ids = validTracking(tracking);
  const enabled = PIXEL_KEYS.filter((key) => ids[key]);
  const sent = useRef(false);
  const enabledKey = enabled.join(",");

  useEffect(() => {
    if (isPreview) return;
    captureUtm();
    if (!product || enabledKey === "" || sent.current) return;
    const globals = enabledKey.split(",").map((key) => PIXEL_GLOBALS[key as keyof typeof PIXEL_GLOBALS]);
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const ready = globals.every((name) => (window as unknown as Record<string, unknown>)[name] !== undefined);
      if (!ready && tries < 50) return;
      window.clearInterval(timer);
      if (sent.current) return;
      sent.current = true;
      track("ViewContent", { content_ids: [product.id], content_name: product.name, value: product.price, num_items: 1 });
    }, 100);
    return () => window.clearInterval(timer);
  }, [enabledKey, isPreview, product]);

  if (isPreview || enabled.length === 0) return null;

  return (
    <>
      {enabled.map((key) => {
        const id = ids[key]!;
        const src = pixelSrc(key, id);
        return (
          <Fragment key={key}>
            {src ? <Script id={`lp-${key}-lib`} src={src} strategy="afterInteractive" /> : null}
            <Script id={`lp-${key}`} strategy="afterInteractive">
              {pixelSnippet(key, id)}
            </Script>
          </Fragment>
        );
      })}
    </>
  );
}
