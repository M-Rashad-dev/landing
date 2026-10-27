"use client";

import { EyeOff, Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { isBuilderMessage, type PreviewToBuilder } from "@/components/builder/protocol";
import type { PreviewData } from "@/lib/pages/api";
import { applyPageDesign } from "@/lib/identity/page-design";
import { DEFAULT_COLORS } from "@/lib/identity/style";
import { cn } from "@/lib/utils";
import { IdentityStyle } from "@/themes/shared/identity-style";
import { SiteEnhancer } from "@/themes/shared/components/site-enhancer";
import { SiteRenderer } from "@/themes/site-renderer";
import type { PageContent, PageContext, PublicIdentity, PublicImage } from "@/themes/types";
import { ar } from "@/messages/ar";

const FALLBACK_IDENTITY: PublicIdentity = {
  brand_name: "",
  colors: DEFAULT_COLORS,
  font_heading: "cairo",
  font_body: "cairo",
  button_radius: "md",
  logo: null,
  favicon: null,
  og_image: null,
  seo_title: null,
  seo_title_suffix: null,
  seo_description: null,
  contact: { phone: null, whatsapp: null, email: null, address: null },
  socials: { facebook: null, instagram: null, tiktok: null, youtube: null, x: null, snapchat: null },
};

const noopSubscribe = () => () => undefined;

/** True inside the Builder iframe (false during SSR). */
function useIsEmbedded(): boolean {
  return useSyncExternalStore(noopSubscribe, () => window.parent !== window, () => false);
}

export function PreviewCanvas({ initial, host }: { initial: PreviewData; host: string }) {
  const [content, setContent] = useState<PageContent>(initial.content);
  const [themeKey, setThemeKey] = useState(initial.theme_key);
  const [media, setMedia] = useState<Record<number, PublicImage>>(initial.media ?? {});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const embedded = useIsEmbedded();

  const post = useCallback((message: PreviewToBuilder) => {
    if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const data = event.data;
      if (!isBuilderMessage(data)) return;
      if (data.type === "builder:select") {
        setSelectedId(data.id);
        if (data.id && data.scroll) {
          document.querySelector(`[data-section-id="${CSS.escape(data.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }
      setContent(data.content);
      setThemeKey(data.themeKey);
      setMedia((current) => ({ ...current, ...data.media }));
    }
    window.addEventListener("message", onMessage);
    post({ type: "preview:ready" });
    return () => window.removeEventListener("message", onMessage);
  }, [post]);

  const ctx: PageContext = useMemo(
    () => ({
      host,
      isPreview: true,
      // The page-only design (builder) shows live over the saved identity.
      identity: applyPageDesign(initial.identity ?? FALLBACK_IDENTITY, content.design),
      product: initial.product,
      offers: initial.offers,
      page: initial.page,
      media,
    }),
    [host, initial.identity, content.design, initial.product, initial.offers, initial.page, media],
  );

  return (
    <IdentityStyle identity={ctx.identity} themeKey={themeKey} className="t-site min-h-dvh">
      {!initial.product ? (
        <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900" style={{ fontFamily: "Cairo, sans-serif" }}>
          <Info className="size-4" aria-hidden />
          {ar.builder.noProductNotice}
        </div>
      ) : null}
      <SiteRenderer
        themeKey={themeKey}
        sections={content.sections}
        ctx={ctx}
        includeHidden={embedded}
        wrap={(section, node) => (
          <div
            role="button"
            tabIndex={-1}
            onClickCapture={(event) => {
              // In the editor a click selects the section. Links and submit buttons do nothing there,
              // but FAQs, sliders, option buttons and the like keep working so they can be tried out.
              if (!embedded) return;
              if ((event.target as Element).closest("a[href], button[type=submit], input[type=submit]")) event.preventDefault();
              setSelectedId(section.id);
              post({ type: "preview:select", id: section.id });
            }}
            className={cn(
              "relative outline-offset-[-2px] transition-[outline-color]",
              embedded && "cursor-pointer hover:outline hover:outline-2 hover:outline-sky-400/70",
              selectedId === section.id && "outline outline-2 outline-sky-500",
              !section.visible && "opacity-40",
            )}
          >
            {!section.visible ? (
              <span className="absolute start-2 top-2 z-10 flex items-center gap-1 rounded bg-black/70 px-2 py-0.5 text-xs text-white" style={{ fontFamily: "Cairo, sans-serif" }}>
                <EyeOff className="size-3" aria-hidden />
                {ar.builder.hidden}
              </span>
            ) : null}
            {node}
          </div>
        )}
      />
      <SiteEnhancer />
    </IdentityStyle>
  );
}
