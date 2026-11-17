"use client";

import { FeaturesForm, TestimonialsForm } from "@/features/builder/section-forms";
import type { Section, SectionType } from "@/themes/landing/bidaya/types";
import { ADDABLE, newLandingSection } from "../builder-api";
import { FaqForm, GalleryForm, HeroForm, OrderFormForm } from "../builder-forms";
import type { LandingBuilderTheme, LandingSectionFormProps } from "./types";

function SectionForm({ section: given, errors, onChange, media, onMedia }: LandingSectionFormProps) {
  const section = given as unknown as Section;
  const set = onChange as (props: Section["props"]) => void;
  switch (section.type) {
    case "hero":
      return <HeroForm props={section.props} onChange={set} errors={errors} media={media} onMedia={onMedia} />;
    case "features":
      return <FeaturesForm props={section.props} onChange={set} errors={errors} max={6} />;
    case "gallery":
      return <GalleryForm props={section.props} onChange={set} errors={errors} media={media} onMedia={onMedia} />;
    case "testimonials":
      return <TestimonialsForm props={section.props} onChange={set} errors={errors} />;
    case "faq":
      return <FaqForm props={section.props} onChange={set} errors={errors} />;
    case "order_form":
      return <OrderFormForm props={section.props} onChange={set} errors={errors} />;
  }
}

/** «بداية»: the shared groups only, and its six sections. */
export const bidayaBuilder: LandingBuilderTheme = {
  maxSections: 12,
  addable: ADDABLE,
  newSection: (type, productName) => newLandingSection(type as Exclude<SectionType, "order_form">, productName),
  SectionForm,
};
