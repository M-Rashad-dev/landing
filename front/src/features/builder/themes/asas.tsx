"use client";

import type { Section, SectionType } from "@/themes/store/asas/types";
import { newSection } from "../api";
import { BannerForm, FeaturesForm, ProductsForm, TestimonialsForm } from "../section-forms";
import { FooterForm, GeneralForm, HeaderForm, LookForm } from "../theme-forms";
import type { BuilderTheme, SectionFormProps } from "./types";

/** The forms of «أساس»'s sections (other themes reuse them for the same types). */
export function AsasSectionForm({ section, onChange, errors, media, onMedia }: SectionFormProps) {
  const s = section as Section;
  switch (s.type) {
    case "banner":
      return <BannerForm props={s.props} onChange={onChange} errors={errors} media={media} onMedia={onMedia} />;
    case "products":
      return <ProductsForm props={s.props} onChange={onChange} errors={errors} />;
    case "features":
      return <FeaturesForm props={s.props} onChange={onChange} errors={errors} />;
    case "testimonials":
      return <TestimonialsForm props={s.props} onChange={onChange} errors={errors} />;
    default:
      return null;
  }
}

/** «أساس» in the Builder: the four base settings groups and its four section types. */
export const asasBuilder: BuilderTheme = {
  groups: [
    { key: "look", Form: LookForm },
    { key: "header", Form: HeaderForm },
    { key: "footer", Form: FooterForm },
    { key: "general", Form: GeneralForm },
  ],
  newSection: (type) => newSection(type as SectionType),
  SectionForm: AsasSectionForm,
};
