"use client";

import type { RawaqSection, RawaqSectionType, RawaqSettings } from "@/themes/store/rawaq/types";
import type { SufiSection } from "@/themes/store/sufi/types";
import { newRawaqSection } from "../api";
import { LibrarySectionForm } from "../library-forms";
import { CtaForm, GlowHeroForm, IngredientsForm, RawaqCardForm, RawaqFooterExtras, RawaqGeneralExtras, RawaqHeaderExtras, RawaqLookExtras, ReelsForm, RoutineForm, ShortcutsForm } from "../rawaq-forms";
import { FooterForm, GeneralForm, HeaderForm, LookForm } from "../theme-forms";
import { AsasSectionForm } from "./asas";
import type { BuilderTheme, GroupFormProps, SectionFormProps } from "./types";

type Extra = React.ComponentType<Omit<GroupFormProps, "settings" | "onChange"> & { settings: RawaqSettings; onChange: (s: RawaqSettings) => void }>;

/** A base group form followed by «رواق»'s own fields for the same group. */
const withRawaq = (Base: React.ComponentType<GroupFormProps>, Extra: Extra) =>
  function RawaqGroup(props: GroupFormProps) {
    return (
      <>
        <Base {...props} />
        <Extra {...props} settings={props.settings as unknown as RawaqSettings} onChange={(s) => props.onChange(s as unknown as GroupFormProps["settings"])} />
      </>
    );
  };

/** A group that is «رواق»'s alone. */
const only = (Form: Extra) =>
  function RawaqOnlyGroup(props: GroupFormProps) {
    return <Form {...props} settings={props.settings as unknown as RawaqSettings} onChange={(s) => props.onChange(s as unknown as GroupFormProps["settings"])} />;
  };

function RawaqForm(props: SectionFormProps) {
  const section = props.section as RawaqSection;
  const onChange = props.onChange as (p: unknown) => void;
  const media = { media: props.media, onMedia: props.onMedia };
  switch (section.type) {
    case "glow_hero":
      return <GlowHeroForm props={section.props} onChange={onChange} errors={props.errors} {...media} />;
    case "shortcuts":
      return <ShortcutsForm props={section.props} onChange={onChange} errors={props.errors} {...media} />;
    case "routine":
      return <RoutineForm props={section.props} onChange={onChange} errors={props.errors} />;
    case "reels":
      return <ReelsForm props={section.props} onChange={onChange} errors={props.errors} {...media} />;
    case "ingredients":
      return <IngredientsForm props={section.props} onChange={onChange} errors={props.errors} />;
    case "cta":
      return <CtaForm props={section.props} onChange={onChange} errors={props.errors} />;
    case "products":
    case "features":
    case "testimonials":
      return <AsasSectionForm {...props} />;
    default:
      // The library types (categories, product tabs, banners, countdown, video, brands, faq).
      return <LibrarySectionForm {...props} section={section as unknown as SufiSection} onChange={onChange} />;
  }
}

/** «رواق» in the Builder: the base groups each with its own fields, «كارد المنتج», and its 16 section types. */
export const rawaqBuilder: BuilderTheme = {
  groups: [
    { key: "look", Form: withRawaq(LookForm, RawaqLookExtras) },
    { key: "header", Form: withRawaq(HeaderForm, RawaqHeaderExtras) },
    { key: "footer", Form: withRawaq(FooterForm, RawaqFooterExtras) },
    { key: "general", Form: withRawaq(GeneralForm, RawaqGeneralExtras) },
    { key: "product_card", Form: only(RawaqCardForm) },
  ],
  newSection: (type) => newRawaqSection(type as RawaqSectionType),
  SectionForm: RawaqForm,
};
