"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { addToCart } from "@/lib/store/cart";
import { sendStoreEvent } from "@/lib/store/events";
import { track } from "@/lib/tracking/track";
import { asasAiTokens, rawaqStoreAiTokens, shabeStoreAiTokens, sufiStoreAiTokens } from "@/themes/shared/ai-section/tokens";
import type { AiSectionProps } from "@/themes/shared/ai-section/types";
import { AiSectionView } from "@/themes/shared/ai-section/view";
import { pick } from "@/themes/shared/design";
import { useScheme } from "../sufi/root";
import { useTheme } from "./context";
import type { ProductCard } from "./types";

export function StoreAiSection({
  section,
  themeKey = "asas_store",
}: {
  section: { id: string; props: AiSectionProps };
  themeKey?: "asas_store" | "sufi_store" | "shabe_store" | "rawaq_store";
}) {
  const { mode, settings, data, media } = useTheme();
  const router = useRouter();
  const { scheme } = useScheme();

  const versionId =
    section.props.version_id ?? data.ai_sections_current?.[String(section.props.ai_section_id)];
  const definition = versionId !== undefined ? data.ai_sections?.[String(versionId)] : null;

  const tokens = React.useMemo(() => {
    if (themeKey === "sufi_store") return sufiStoreAiTokens(settings, scheme);
    if (themeKey === "shabe_store") return shabeStoreAiTokens(settings);
    if (themeKey === "rawaq_store") return rawaqStoreAiTokens(settings);
    return asasAiTokens(settings);
  }, [themeKey, settings, scheme]);

  const mergedMedia = React.useMemo(() => ({ ...data.media, ...media }), [data.media, media]);

  const handleAdd = React.useCallback(
    (productId: number) => {
      if (mode !== "live") return;
      let found: ProductCard | null = null;
      for (const list of Object.values(data.products ?? {})) {
        const hit = list.find((p) => p.id === productId);
        if (hit) {
          found = hit;
          break;
        }
      }
      if (!found) return;

      if (!found.available || found.needs_options) {
        router.push(`/products/${encodeURIComponent(found.slug)}`);
        return;
      }

      const res = addToCart({
        product_id: found.id,
        quantity: 1,
        options: {},
        name: found.name,
        slug: found.slug,
        image: pick(found.image?.urls, "thumb"),
        price: found.price,
        options_label: "",
        max: found.max_quantity ?? null,
      });

      if (res === "added") {
        sendStoreEvent("add_to_cart");
        track("AddToCart", {
          content_ids: [found.id],
          content_name: found.name,
          value: found.price,
          num_items: 1,
        });
      }
    },
    [mode, data.products, router],
  );

  return (
    <AiSectionView
      sectionId={section.id}
      definition={definition}
      values={section.props.values ?? {}}
      mode={mode}
      tokens={tokens}
      data={{
        products: data.products,
        categories: data.category_tiles,
        links: data.links,
        media: mergedMedia,
      }}
      onAdd={handleAdd}
      sampleMode={mode === "builder"}
    />
  );
}

