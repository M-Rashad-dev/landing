import type { MediaItem } from "@/lib/types";
import type { PageContent, PublicImage } from "@/themes/types";

/** Media ids referenced by content (keys ending in _media_id / _media_ids), like the back end. */
export function contentMediaIds(content: PageContent): number[] {
  const ids = new Set<number>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (key.endsWith("_media_id") && typeof value === "number") ids.add(value);
        else if (key.endsWith("_media_ids") && Array.isArray(value)) value.forEach((v) => typeof v === "number" && ids.add(v));
        else walk(value);
      }
    }
  };
  content.sections.forEach((section) => walk(section.props));
  return [...ids];
}

export function toPublicImage(item: MediaItem): PublicImage {
  return { id: item.id, alt: item.alt, width: item.width, height: item.height, urls: { thumb: item.urls.thumb, medium: item.urls.medium, large: item.urls.large } };
}
