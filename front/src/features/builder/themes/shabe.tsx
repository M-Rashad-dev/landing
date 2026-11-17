"use client";

import type { ShabeStoreSection, ShabeStoreSectionType, ShabeStoreSettings } from "@/themes/store/shabe/types";
import type { SufiSection } from "@/themes/store/sufi/types";
import { newShabeStoreSection } from "../api";
import { LibrarySectionForm } from "../library-forms";
import { BundlesForm, FoodHeroForm, HoursForm, ShabeCardForm, ShabeFooterExtras, ShabeGeneralExtras, ShabeHeaderExtras, ShabeLookExtras, ShabePageForm, StepsForm, WhyForm } from "../shabe-store-forms";
import { FooterForm, GeneralForm, HeaderForm, LookForm } from "../theme-forms";
import { AsasSectionForm } from "./asas";
import type { BuilderTheme, GroupFormProps, SectionFormProps } from "./types";

type Extra = React.ComponentType<Omit<GroupFormProps, "settings" | "onChange"> & { settings: ShabeStoreSettings; onChange: (s: ShabeStoreSettings) => void }>;

/** A base group form followed by «شابع»'s own fields for the same group. */
const withShabe = (Base: React.ComponentType<GroupFormProps>, Extra: Extra) =>
  function ShabeGroup(props: GroupFormProps) {
    return (
      <>
        <Base {...props} />
        <Extra {...props} settings={props.settings as unknown as ShabeStoreSettings} onChange={(s) => props.onChange(s as unknown as GroupFormProps["settings"])} />
      </>
    );
  };

/** A group that is «شابع»'s alone. */
const only = (Form: Extra) =>
  function ShabeOnlyGroup(props: GroupFormProps) {
    return <Form {...props} settings={props.settings as unknown as ShabeStoreSettings} onChange={(s) => props.onChange(s as unknown as GroupFormProps["settings"])} />;
  };

function ShabeForm(props: SectionFormProps) {
  const section = props.section as ShabeStoreSection;
  const onChange = props.onChange as (p: unknown) => void;
  const media = { media: props.media, onMedia: props.onMedia };
  switch (section.type) {
    case "food_hero":
      return <FoodHeroForm props={section.props} onChange={onChange} errors={props.errors} {...media} />;
    case "why":
      return <WhyForm props={section.props} onChange={onChange} errors={props.errors} {...media} />;
    case "steps":
      return <StepsForm props={section.props} onChange={onChange} errors={props.errors} />;
    case "bundles":
      return <BundlesForm props={section.props} onChange={onChange} errors={props.errors} {...media} />;
    case "hours":
      return <HoursForm props={section.props} onChange={onChange} errors={props.errors} />;
    case "products":
    case "testimonials":
      return <AsasSectionForm {...props} />;
    default:
      // The library types (marquee, categories, menu tabs, countdown, video, gallery, faq, branches).
      return <LibrarySectionForm {...props} section={section as unknown as SufiSection} onChange={onChange} />;
  }
}

/** «شابع · متجر» in the Builder: the base groups each with its own fields, and its 15 section types, plus «كارد المنتج» and «صفحة المنتج». */
export const shabeBuilder: BuilderTheme = {
  groups: [
    { key: "look", Form: withShabe(LookForm, ShabeLookExtras) },
    { key: "header", Form: withShabe(HeaderForm, ShabeHeaderExtras) },
    { key: "footer", Form: withShabe(FooterForm, ShabeFooterExtras) },
    { key: "general", Form: withShabe(GeneralForm, ShabeGeneralExtras) },
    // Its own groups (no base form: only themes that draw these their way have them).
    { key: "product_card", Form: only(ShabeCardForm) },
    { key: "product_page", Form: only(ShabePageForm) },
  ],
  newSection: (type) => newShabeStoreSection(type as ShabeStoreSectionType),
  SectionForm: ShabeForm,
};
