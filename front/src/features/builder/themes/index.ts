import { ASAS_KEY } from "@/themes/store/asas/types";
import { SUFI_KEY } from "@/themes/store/sufi/types";
import { asasBuilder } from "./asas";
import { sufiBuilder } from "./sufi";
import type { BuilderTheme } from "./types";

/**
 * Every store theme in the Builder, by key: the only place the Builder picks by theme. It must
 * list the same keys as the storefront registry (themes/store/registry.tsx); a test checks it.
 */
export const BUILDER_THEMES: Record<string, BuilderTheme> = {
  [ASAS_KEY]: asasBuilder,
  [SUFI_KEY]: sufiBuilder,
};

export function builderTheme(key: string): BuilderTheme {
  return BUILDER_THEMES[key] ?? BUILDER_THEMES[ASAS_KEY];
}
