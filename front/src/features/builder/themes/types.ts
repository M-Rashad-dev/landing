import type * as React from "react";
import type { MediaItem } from "@/features/media/api";
import type { MediaUrls } from "@/themes/shared/design";
import type { StoreSettings } from "@/themes/store/shared/types";
import type { AnySection } from "../api";
import type { AnySectionType } from "../section-gallery";

export type Errors = Record<string, string>;
export type MediaProps = { media: Record<string, MediaUrls>; onMedia: (item: MediaItem) => void };

/**
 * The settings groups a store theme can have (the back end lists a theme's groups in
 * StoreThemeDesign::SETTINGS_GROUPS). Every theme has the first four; a theme that draws product
 * cards, product pages, category pages or the cart its own way adds the group for it.
 */
export type GroupKey = "look" | "header" | "footer" | "general";

/** A settings group's form: it edits the theme settings and hands them back whole. */
export type GroupFormProps = { settings: StoreSettings; onChange: (settings: StoreSettings) => void; errors: Errors } & MediaProps;

/** A home section's form. */
export type SectionFormProps = { section: AnySection; onChange: (props: AnySection["props"]) => void; errors: Errors } & MediaProps;

/**
 * What the Builder needs from a store theme: the form of each settings group it has (in order) and
 * of each home section type it offers, and a new section of a type. Which section types it offers
 * and how many come from the server (the design payload), so the two never disagree.
 */
export type BuilderTheme = {
  groups: Array<{ key: GroupKey; Form: React.ComponentType<GroupFormProps> }>;
  newSection: (type: AnySectionType) => AnySection;
  SectionForm: React.ComponentType<SectionFormProps>;
};
