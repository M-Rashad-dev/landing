"use client";

import type { TestimonialsProps } from "@/themes/store/asas/types";
import type { SufiSection, SufiSectionType, SufiSettings } from "@/themes/store/sufi/types";
import { newSufiSection } from "../api";
import { LibrarySectionForm } from "../library-forms";
import { SufiFooterExtras, SufiGeneralExtras, SufiHeaderExtras, SufiLookExtras, SufiTestimonialsExtras } from "../sufi-forms";
import { FooterForm, GeneralForm, HeaderForm, LookForm } from "../theme-forms";
import { AsasSectionForm } from "./asas";
import type { BuilderTheme, GroupFormProps, SectionFormProps } from "./types";

/** A base group form followed by «صوفي»'s own fields for the same group. */
const withSufi =
  (Base: React.ComponentType<GroupFormProps>, Extra: React.ComponentType<Omit<GroupFormProps, "settings" | "onChange"> & { settings: SufiSettings; onChange: (s: SufiSettings) => void }>) =>
  function SufiGroup(props: GroupFormProps) {
    return (
      <>
        <Base {...props} />
        <Extra {...props} settings={props.settings as SufiSettings} onChange={props.onChange} />
      </>
    );
  };

const SHARED = ["banner", "products", "features", "testimonials"];

function SufiForm(props: SectionFormProps) {
  const { section, onChange } = props;
  if (!SHARED.includes(section.type)) return <LibrarySectionForm {...props} section={section as SufiSection} onChange={onChange} />;
  return (
    <>
      <AsasSectionForm {...props} />
      {section.type === "testimonials" ? <SufiTestimonialsExtras props={section.props as TestimonialsProps} onChange={onChange} /> : null}
    </>
  );
}

/** «صوفي» in the Builder: the base groups each with its own extra fields, and its 16 section types. */
export const sufiBuilder: BuilderTheme = {
  groups: [
    { key: "look", Form: withSufi(LookForm, SufiLookExtras) },
    { key: "header", Form: withSufi(HeaderForm, SufiHeaderExtras) },
    { key: "footer", Form: withSufi(FooterForm, SufiFooterExtras) },
    { key: "general", Form: withSufi(GeneralForm, SufiGeneralExtras) },
  ],
  newSection: (type) => newSufiSection(type as SufiSectionType),
  SectionForm: SufiForm,
};
