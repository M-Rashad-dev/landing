"use client";

import type { SufiSection } from "@/themes/store/sufi/types";
import type { TeknoSection, TeknoSectionType, TeknoSettings } from "@/themes/store/tekno/types";
import { newTeknoSection } from "../api";
import { LibrarySectionForm } from "../library-forms";
import { CtaForm } from "../rawaq-forms";
import { ProductsForm } from "../section-forms";
import { DealOfDayForm, InstallmentsForm, MegaMenuForm, ServicesForm, TechHeroForm, TeknoCardForm, TeknoFeaturesForm, TeknoFooterExtras, TeknoHeaderExtras, TeknoLookExtras, TeknoTabsForm, TeknoTestimonialsForm } from "../tekno-forms";
import { FooterForm, GeneralForm, HeaderForm, LookForm } from "../theme-forms";
import type { BuilderTheme, GroupFormProps, SectionFormProps } from "./types";

type Extra = React.ComponentType<Omit<GroupFormProps, "settings" | "onChange"> & { settings: TeknoSettings; onChange: (s: TeknoSettings) => void }>;

/** A base group form followed by «تيكنو»'s own fields for the same group. */
const withTekno = (Base: React.ComponentType<GroupFormProps>, Extra: Extra) =>
  function TeknoGroup(props: GroupFormProps) {
    return (
      <>
        <Base {...props} />
        <Extra {...props} settings={props.settings as unknown as TeknoSettings} onChange={(s) => props.onChange(s as unknown as GroupFormProps["settings"])} />
      </>
    );
  };

/** A group that is «تيكنو»'s alone. */
const only = (Form: Extra) =>
  function TeknoOnlyGroup(props: GroupFormProps) {
    return <Form {...props} settings={props.settings as unknown as TeknoSettings} onChange={(s) => props.onChange(s as unknown as GroupFormProps["settings"])} />;
  };

function TeknoForm(props: SectionFormProps) {
  const section = props.section as TeknoSection;
  const onChange = props.onChange as (p: unknown) => void;
  const media = { media: props.media, onMedia: props.onMedia };
  switch (section.type) {
    case "tech_hero":
      return <TechHeroForm props={section.props} onChange={onChange} errors={props.errors} {...media} />;
    case "deal_of_day":
      return <DealOfDayForm props={section.props} onChange={onChange} errors={props.errors} />;
    case "services":
      return <ServicesForm props={section.props} onChange={onChange} errors={props.errors} />;
    case "features":
      return <TeknoFeaturesForm props={section.props} onChange={onChange} errors={props.errors} />;
    case "product_tabs":
      return <TeknoTabsForm section={section} onChange={onChange} errors={props.errors} {...media} />;
    case "testimonials":
      return <TeknoTestimonialsForm props={section.props} onChange={onChange} errors={props.errors} />;
    case "products":
      return <ProductsForm props={section.props} onChange={onChange} errors={props.errors} />;
    case "cta":
      return <CtaForm props={section.props} onChange={onChange} errors={props.errors} />;
    default:
      // The library types (categories, banners, countdown, video, brands, faq).
      return <LibrarySectionForm {...props} section={section as unknown as SufiSection} onChange={onChange} />;
  }
}

/** «تيكنو» in the Builder: the base groups with its own fields, the mega menu, its card and installments, and its section types. */
export const teknoBuilder: BuilderTheme = {
  groups: [
    { key: "look", Form: withTekno(LookForm, TeknoLookExtras) },
    { key: "header", Form: withTekno(HeaderForm, TeknoHeaderExtras) },
    { key: "footer", Form: withTekno(FooterForm, TeknoFooterExtras) },
    { key: "general", Form: GeneralForm },
    { key: "mega_menu", Form: only(MegaMenuForm) },
    { key: "product_card", Form: only(TeknoCardForm) },
    { key: "installments", Form: only(InstallmentsForm) },
  ],
  newSection: (type) => newTeknoSection(type as TeknoSectionType),
  SectionForm: TeknoForm,
};
