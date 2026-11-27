import type { Content, LandingData } from "./bidaya/types";
import { BIDAYA_DEMO_DATA, bidayaDemoContent } from "./bidaya/demo";
import type { LandingThemeKey } from "./keys";
import { RAWAQ_LANDING_DEMO_DATA, rawaqLandingDemoContent } from "./rawaq/demo";
import { SHABE_DEMO_DATA, shabeDemoContent } from "./shabe/demo";
import { SUFI_LANDING_DEMO_DATA, sufiLandingDemoContent } from "./sufi/demo";

/** A landing theme's showcase page (fixed sample, never saved): its content, the product it sells, and whether it has light/dark. */
export type LandingDemo = { content: () => Content; data: LandingData; schemes: boolean };

/**
 * Every landing theme's showcase («معاينة الثيم»), drawn with the theme's own page from the
 * landing registry. Every theme has one (a test checks the keys).
 */
export const LANDING_DEMOS: Record<LandingThemeKey, LandingDemo> = {
  bidaya_landing: { content: bidayaDemoContent, data: BIDAYA_DEMO_DATA, schemes: false },
  shabe_landing: { content: () => shabeDemoContent() as unknown as Content, data: SHABE_DEMO_DATA, schemes: false },
  sufi_landing: { content: () => sufiLandingDemoContent() as unknown as Content, data: SUFI_LANDING_DEMO_DATA, schemes: true },
  rawaq_landing: { content: rawaqLandingDemoContent, data: RAWAQ_LANDING_DEMO_DATA, schemes: false },
};

export const hasLandingDemo = (key: string): key is LandingThemeKey => key in LANDING_DEMOS;
