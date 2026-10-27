"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMediaByIds } from "@/lib/media/hooks";
import { useBuilder } from "./context";
import { contentMediaIds, toPublicImage } from "./media-map";
import { isPreviewMessage, type BuilderToPreview } from "./protocol";

export type Device = "mobile" | "tablet" | "desktop";
export const DEVICE_WIDTH: Record<Device, number> = { mobile: 390, tablet: 768, desktop: 1280 };

/**
 * The preview iframe (/preview/{id}) kept in sync with the store over postMessage.
 * Wide devices are scaled down to fit the panel.
 */
export function PreviewFrame({ pageId, device, reloadKey, onSelect }: { pageId: number; device: Device; reloadKey: number; onSelect: (id: string) => void }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const container = useRef<HTMLDivElement>(null);
  // Ready is tracked per iframe load (reloadKey) so a reload waits for the new document.
  const [readyKey, setReadyKey] = useState(-1);
  const ready = readyKey === reloadKey;
  const [available, setAvailable] = useState(0);
  const content = useBuilder((s) => s.content);
  const themeKey = useBuilder((s) => s.themeKey);
  const selectedId = useBuilder((s) => s.selectedId);

  const ids = useMemo(() => contentMediaIds(content), [content]);
  const { items } = useMediaByIds(ids);
  const media = useMemo(() => Object.fromEntries(items.map((item) => [item.id, toPublicImage(item)])), [items]);

  const send = (message: BuilderToPreview) => iframe.current?.contentWindow?.postMessage(message, window.location.origin);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== iframe.current?.contentWindow) return;
      if (!isPreviewMessage(event.data)) return;
      if (event.data.type === "preview:ready") setReadyKey(reloadKey);
      if (event.data.type === "preview:select") onSelect(event.data.id);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelect, reloadKey]);

  // Push every content change (cheap: same-origin structured clone).
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => send({ type: "builder:update", content, themeKey, media }));
    return () => cancelAnimationFrame(frame);
  }, [ready, content, themeKey, media]);

  useEffect(() => {
    if (ready) send({ type: "builder:select", id: selectedId, scroll: true });
  }, [ready, selectedId]);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const phone = device === "mobile";
  // The phone frame's border is added on top, so the page still renders at the device width.
  const width = DEVICE_WIDTH[device] + (phone ? 20 : 2);
  const scale = available > 0 ? Math.min(1, (available - 32) / width) : 1;

  // Width, scale and corners animate together, so switching device morphs instead of jumping.
  const morph = "width 480ms var(--ease-out), height 480ms var(--ease-out), transform 480ms var(--ease-out), border-radius 480ms var(--ease-out), border-width 480ms var(--ease-out)";

  return (
    <div ref={container} className="flex h-full justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--primary)_6%,var(--muted)),var(--muted))] p-4">
      <div style={{ width: width * scale, height: "100%", transition: morph }}>
        <iframe
          key={reloadKey}
          ref={iframe}
          src={`/preview/${pageId}`}
          title="preview"
          className="border-[#12152a] bg-white shadow-lg"
          style={{
            width,
            height: `${100 / scale}%`,
            transform: `scale(${scale})`,
            transformOrigin: "top right",
            borderRadius: phone ? 36 : 14,
            borderWidth: phone ? 10 : 1,
            borderColor: phone ? "#12152a" : "var(--border)",
            transition: morph,
          }}
        />
      </div>
    </div>
  );
}
