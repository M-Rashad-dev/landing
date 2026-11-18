"use client";

import * as React from "react";
import { bidayaLandingAiTokens, shabeLandingAiTokens, sufiLandingAiTokens } from "@/themes/shared/ai-section/tokens";
import type { AiSectionProps } from "@/themes/shared/ai-section/types";
import { AiSectionView } from "@/themes/shared/ai-section/view";
import { pick, type MediaUrls } from "@/themes/shared/design";
import { usePage } from "../bidaya/context";
import { useSufiScheme } from "../sufi/root";

export function LandingAiSection({
  section,
  themeKey = "bidaya_landing",
}: {
  section: { id: string; props: AiSectionProps };
  themeKey?: "bidaya_landing" | "shabe_landing" | "sufi_landing";
}) {
  const { mode, settings, data, media } = usePage();
  const { scheme } = useSufiScheme();

  const versionId =
    section.props.version_id ?? data.ai_sections_current?.[String(section.props.ai_section_id)];
  const definition = versionId !== undefined ? data.ai_sections?.[String(versionId)] : null;

  const tokens = React.useMemo(() => {
    if (themeKey === "sufi_landing") return sufiLandingAiTokens(settings, scheme);
    if (themeKey === "shabe_landing") return shabeLandingAiTokens(settings);
    return bidayaLandingAiTokens(settings);
  }, [themeKey, settings, scheme]);

  const mergedMedia = React.useMemo(() => {
    const out: Record<string, MediaUrls> = {};
    for (const [k, img] of Object.entries(data.media ?? {})) {
      if (img?.urls) {
        out[k] = img.urls;
      }
    }
    for (const [k, urls] of Object.entries(media ?? {})) {
      out[k] = urls;
    }
    return out;
  }, [data.media, media]);

  const landingProduct = React.useMemo(() => {
    const p = data.product;
    if (!p) return null;
    const firstImg = p.images?.[0]?.urls;
    return {
      name: p.name,
      price: p.price,
      compare_at_price: p.compare_at_price,
      image: pick(firstImg, "large") ?? pick(firstImg, "medium"),
    };
  }, [data.product]);

  return (
    <AiSectionView
      sectionId={section.id}
      definition={definition}
      values={section.props.values ?? {}}
      mode={mode}
      tokens={tokens}
      data={{
        media: mergedMedia,
        landingProduct,
      }}
      sampleMode={mode === "builder"}
    />
  );
}

