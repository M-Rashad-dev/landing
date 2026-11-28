import { ASAS_KEY } from "@/themes/store/asas/types";
import { RAWAQ_KEY } from "@/themes/store/rawaq/types";
import { SHABE_STORE_KEY } from "@/themes/store/shabe/types";
import { SUFI_KEY } from "@/themes/store/sufi/types";
import { TEKNO_KEY } from "@/themes/store/tekno/types";
import { asasBuilder } from "./asas";
import { rawaqBuilder } from "./rawaq";
import { shabeBuilder } from "./shabe";
import { sufiBuilder } from "./sufi";
import { teknoBuilder } from "./tekno";
import type { BuilderTheme } from "./types";

/**
 * Every store theme in the Builder, by key: the only place the Builder picks by theme. It must
 * list the same keys as the storefront registry (themes/store/registry.tsx); a test checks it.
 */
export const BUILDER_THEMES: Record<string, BuilderTheme> = {
  [ASAS_KEY]: asasBuilder,
  [SUFI_KEY]: sufiBuilder,
  [SHABE_STORE_KEY]: shabeBuilder,
  [RAWAQ_KEY]: rawaqBuilder,
  [TEKNO_KEY]: teknoBuilder,
};

export function builderTheme(key: string): BuilderTheme {
  return BUILDER_THEMES[key] ?? BUILDER_THEMES[ASAS_KEY];
}
