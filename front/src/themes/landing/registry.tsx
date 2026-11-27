"use client";

import type * as React from "react";
import { bidayaLandingAiTokens, rawaqLandingAiTokens, shabeLandingAiTokens, sufiLandingAiTokens } from "@/themes/shared/ai-section/tokens";
import type { AiTokens } from "@/themes/shared/ai-section/types";
import type { MediaUrls } from "@/themes/shared/design";
import { BidayaRoot, type PageMode } from "./bidaya/context";
import { BidayaPage, type Selection } from "./bidaya/page";
import type { Content, LandingData, Settings } from "./bidaya/types";
import { DEFAULT_LANDING_THEME, LANDING_THEME_KEYS, type LandingThemeKey } from "./keys";
import { RawaqLandingPage } from "./rawaq/page";
import { RawaqLandingRoot } from "./rawaq/root";
import type { RawaqLandingContent, RawaqLandingSettings } from "./rawaq/types";
import { ShabePage } from "./shabe/page";
import { ShabeRoot } from "./shabe/root";
import type { ShabeContent, ShabeSettings } from "./shabe/types";
import { SufiLandingPage } from "./sufi/page";
import { SufiLandingRoot } from "./sufi/root";
import type { SufiLandingContent, SufiLandingSettings } from "./sufi/types";

export type { Selection };

/** What every landing theme's page takes: its content, the page data, where it is drawn, and the Builder's hooks. */
export type LandingPageProps = {
  content: Content;
  data: LandingData;
  mode?: PageMode;
  selected?: Selection;
  onSelect?: (id: Selection) => void;
  tools?: (id: Selection) => React.ReactNode;
  media?: Record<string, MediaUrls>;
};

/** The theme's frame alone (colors, fonts, page context), for pages around the landing page («طلبك وصل»). */
export type LandingRootProps = { settings: Settings; data: LandingData; mode: PageMode; media?: Record<string, MediaUrls>; className?: string; children: React.ReactNode };

export type LandingTheme = {
  Page: React.ComponentType<LandingPageProps>;
  Root: React.ComponentType<LandingRootProps>;
  aiTokens: (settings: unknown, scheme?: "light" | "dark") => AiTokens;
};

/*
 * Every landing theme by key: the only place the front end picks a landing theme. Each theme's
 * content is its own shape (checked by the back end); the registry hands it over as is.
 */
const THEMES: Record<LandingThemeKey, LandingTheme> = {
  bidaya_landing: { Page: BidayaPage, Root: BidayaRoot, aiTokens: (s) => bidayaLandingAiTokens(s) },
  shabe_landing: {
    Page: ({ content, ...rest }) => <ShabePage content={content as unknown as ShabeContent} {...rest} />,
    Root: ({ settings, ...rest }) => <ShabeRoot settings={settings as unknown as ShabeSettings} {...rest} />,
    aiTokens: (s) => shabeLandingAiTokens(s),
  },
  sufi_landing: {
    Page: ({ content, ...rest }) => <SufiLandingPage content={content as unknown as SufiLandingContent} {...rest} />,
    Root: ({ settings, ...rest }) => <SufiLandingRoot settings={settings as unknown as SufiLandingSettings} {...rest} />,
    aiTokens: sufiLandingAiTokens,
  },
  rawaq_landing: {
    Page: ({ content, ...rest }) => <RawaqLandingPage content={content as unknown as RawaqLandingContent} {...rest} />,
    Root: ({ settings, ...rest }) => <RawaqLandingRoot settings={settings as unknown as RawaqLandingSettings} {...rest} />,
    aiTokens: (s) => rawaqLandingAiTokens(s),
  },
};

export const isLandingTheme = (key: string): key is LandingThemeKey => (LANDING_THEME_KEYS as readonly string[]).includes(key);

/** The theme of a key (the free theme for a key the front end doesn't know). */
export function landingTheme(key: string): LandingTheme {
  return THEMES[isLandingTheme(key) ? key : DEFAULT_LANDING_THEME];
}

export const LANDING_THEMES = THEMES;
