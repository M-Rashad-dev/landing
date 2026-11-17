import type { DesignData } from "./shared/types";
import { SHABE_DEMO_DATA, SHABE_DEMO_DESIGN } from "./shabe/demo";
import { SHABE_STORE_KEY } from "./shabe/types";
import { SUFI_DEMO_DATA, SUFI_DEMO_DESIGN } from "./sufi/demo";
import { SUFI_KEY } from "./sufi/types";

/** A theme's showcase store (fixed sample, never saved): its design, data, name, and whether it has light/dark. */
export type StoreDemo = { design: unknown; data: DesignData; storeName: string; schemes: boolean };

/**
 * Every store theme with a showcase («معاينة الثيم»), drawn with the theme's own canvas from
 * the store registry. themes/registry.ts lists the same keys (a test checks it).
 */
export const STORE_DEMOS: Record<string, StoreDemo> = {
  [SUFI_KEY]: { design: SUFI_DEMO_DESIGN, data: SUFI_DEMO_DATA, storeName: "صُوفي", schemes: true },
  [SHABE_STORE_KEY]: { design: SHABE_DEMO_DESIGN, data: SHABE_DEMO_DATA, storeName: "شابع", schemes: false },
};
