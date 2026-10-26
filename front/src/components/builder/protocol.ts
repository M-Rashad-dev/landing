import type { PageContent, PublicImage } from "@/themes/types";

/**
 * postMessage protocol between the Builder (parent) and the preview iframe (same origin).
 * Every message is checked for origin and shape before use.
 */
export type BuilderToPreview =
  | { type: "builder:init"; content: PageContent; themeKey: string; media: Record<number, PublicImage> }
  | { type: "builder:update"; content: PageContent; themeKey: string; media: Record<number, PublicImage> }
  | { type: "builder:select"; id: string | null; scroll: boolean };

export type PreviewToBuilder =
  | { type: "preview:ready" }
  | { type: "preview:select"; id: string }
  | { type: "preview:viewport"; width: number; height: number };

const BUILDER_TYPES = new Set(["builder:init", "builder:update", "builder:select"]);
const PREVIEW_TYPES = new Set(["preview:ready", "preview:select", "preview:viewport"]);

export function isBuilderMessage(data: unknown): data is BuilderToPreview {
  return typeof data === "object" && data !== null && BUILDER_TYPES.has((data as { type?: string }).type ?? "");
}

export function isPreviewMessage(data: unknown): data is PreviewToBuilder {
  return typeof data === "object" && data !== null && PREVIEW_TYPES.has((data as { type?: string }).type ?? "");
}
