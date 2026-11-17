"use client";

import type { ShabeSection, ShabeSectionType, ShabeSettings } from "@/themes/landing/shabe/types";
import { SHABE_MAX_SECTIONS } from "@/themes/landing/shabe/types";
import type { Settings } from "@/themes/landing/bidaya/types";
import { newShabeSection, SHABE_ADDABLE, ShabeHeaderExtras, ShabeLookExtras, ShabeSectionForm } from "../shabe-forms";
import type { LandingBuilderTheme, LandingExtrasProps, LandingSection, LandingSectionFormProps } from "./types";

const own = ({ settings, onChange, errors }: LandingExtrasProps) => ({ settings: settings as unknown as ShabeSettings, onChange: (s: ShabeSettings) => onChange(s as unknown as Settings), errors });

/** «شابع»: the food sections, the dark color and title font, and the header countdown, phone and button. */
export const shabeBuilder: LandingBuilderTheme = {
  maxSections: SHABE_MAX_SECTIONS,
  addable: SHABE_ADDABLE,
  newSection: (type, productName) => newShabeSection(type as Exclude<ShabeSectionType, "order_form">, productName) as unknown as LandingSection,
  SectionForm: ({ section, onChange, ...rest }: LandingSectionFormProps) => <ShabeSectionForm section={section as unknown as ShabeSection} onChange={onChange as (props: ShabeSection["props"]) => void} {...rest} />,
  extras: {
    look: (props) => <ShabeLookExtras {...own(props)} />,
    header: (props) => <ShabeHeaderExtras {...own(props)} />,
  },
};
