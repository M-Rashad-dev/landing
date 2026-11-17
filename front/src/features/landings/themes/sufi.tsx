"use client";

import type { Settings } from "@/themes/landing/bidaya/types";
import { SUFI_LANDING_MAX_SECTIONS, type SufiLandingSection, type SufiLandingSectionType, type SufiLandingSettings } from "@/themes/landing/sufi/types";
import { newSufiLandingSection, SUFI_LANDING_ADDABLE, SufiGeneralExtras, SufiHeaderExtras, SufiLandingSectionForm, SufiLookExtras } from "../sufi-forms";
import type { LandingBuilderTheme, LandingExtrasProps, LandingSection, LandingSectionFormProps } from "./types";

const own = ({ settings, onChange, ...rest }: LandingExtrasProps) => ({ settings: settings as unknown as SufiLandingSettings, onChange: (s: SufiLandingSettings) => onChange(s as unknown as Settings), ...rest });

/** «صوفي»: the premium-product sections, the dark mode, the title font, the header button and motion. */
export const sufiBuilder: LandingBuilderTheme = {
  maxSections: SUFI_LANDING_MAX_SECTIONS,
  addable: SUFI_LANDING_ADDABLE,
  newSection: (type, productName) => newSufiLandingSection(type as Exclude<SufiLandingSectionType, "order_form">, productName) as unknown as LandingSection,
  SectionForm: ({ section, onChange, ...rest }: LandingSectionFormProps) => <SufiLandingSectionForm section={section as unknown as SufiLandingSection} onChange={onChange as (props: SufiLandingSection["props"]) => void} {...rest} />,
  extras: {
    look: (props) => <SufiLookExtras {...own(props)} />,
    header: (props) => <SufiHeaderExtras {...own(props)} />,
    general: (props) => <SufiGeneralExtras {...own(props)} />,
  },
};
