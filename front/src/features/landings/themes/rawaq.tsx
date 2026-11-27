"use client";

import type { Settings } from "@/themes/landing/bidaya/types";
import { RAWAQ_LANDING_MAX_SECTIONS, type RawaqLandingSection, type RawaqLandingSectionType, type RawaqLandingSettings } from "@/themes/landing/rawaq/types";
import { newRawaqLandingSection, RAWAQ_LANDING_ADDABLE, RawaqGeneralExtras, RawaqHeaderExtras, RawaqLandingSectionForm, RawaqLookExtras } from "../rawaq-forms";
import type { LandingBuilderTheme, LandingExtrasProps, LandingSection, LandingSectionFormProps } from "./types";

const own = ({ settings, onChange, errors }: LandingExtrasProps) => ({ settings: settings as unknown as RawaqLandingSettings, onChange: (s: RawaqLandingSettings) => onChange(s as unknown as Settings), errors });

/** «رواق»: the beauty sections, the dark color and title font, the header button and motion. */
export const rawaqBuilder: LandingBuilderTheme = {
  maxSections: RAWAQ_LANDING_MAX_SECTIONS,
  addable: RAWAQ_LANDING_ADDABLE,
  newSection: (type, productName) => newRawaqLandingSection(type as Exclude<RawaqLandingSectionType, "order_form">, productName) as unknown as LandingSection,
  SectionForm: ({ section, onChange, ...rest }: LandingSectionFormProps) => <RawaqLandingSectionForm section={section as unknown as RawaqLandingSection} onChange={onChange as (props: RawaqLandingSection["props"]) => void} {...rest} />,
  extras: {
    look: (props) => <RawaqLookExtras {...own(props)} />,
    header: (props) => <RawaqHeaderExtras {...own(props)} />,
    general: (props) => <RawaqGeneralExtras {...own(props)} />,
  },
};
