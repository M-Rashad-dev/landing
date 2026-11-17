import type * as React from "react";
import type { MediaItem } from "@/features/media/api";
import type { ProductOffer } from "@/lib/store/types";
import type { MediaUrls } from "@/themes/shared/design";
import type { Settings } from "@/themes/landing/bidaya/types";

export type Errors = Record<string, string>;
export type MediaProps = { media: Record<string, MediaUrls>; onMedia: (item: MediaItem) => void };

/** A section of any landing theme, as the Builder moves it around (its props are the theme's business). */
export type LandingSection = { id: string; type: string; visible: boolean; props: Record<string, unknown> };

/** A section's form: it edits the section's props and hands them back whole. */
export type LandingSectionFormProps = { section: LandingSection; onChange: (props: LandingSection["props"]) => void; errors: Errors; offers: ProductOffer[] } & MediaProps;

/** The theme settings groups every landing page has (the shared forms draw «بداية»'s part of each). */
export type LandingGroup = "look" | "header" | "footer" | "general";

/** A theme's own fields under a shared group's form (its settings are a superset of «بداية»'s). */
export type LandingExtrasProps = { settings: Settings; onChange: (settings: Settings) => void; errors: Errors } & MediaProps;

/**
 * What the Builder needs from a landing theme: the sections a merchant can add (the order form is
 * always there, once), a new section of a type, each section's form, and the theme's own settings
 * fields under the shared groups. The back end checks the same shape (App\Themes\Landing\*Design).
 */
export type LandingBuilderTheme = {
  maxSections: number;
  addable: string[];
  newSection: (type: string, productName: string | null) => LandingSection;
  SectionForm: React.ComponentType<LandingSectionFormProps>;
  extras?: Partial<Record<LandingGroup, React.ComponentType<LandingExtrasProps>>>;
};
