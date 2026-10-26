import type { ComponentSchema, ComponentType } from "@/themes/types";
import { faqSchema } from "./faq";
import { featuresSchema } from "./features";
import { footerSchema } from "./footer";
import { gallerySchema } from "./gallery";
import { headerSchema } from "./header";
import { heroSchema } from "./hero";
import { offersSchema } from "./offers";
import { orderFormSchema } from "./order-form";
import { productShowcaseSchema } from "./product-showcase";
import { testimonialsSchema } from "./testimonials";

export const SCHEMAS: Record<ComponentType, ComponentSchema> = {
  header: headerSchema,
  hero: heroSchema,
  gallery: gallerySchema,
  product_showcase: productShowcaseSchema,
  features: featuresSchema,
  offers: offersSchema,
  testimonials: testimonialsSchema,
  faq: faqSchema,
  order_form: orderFormSchema,
  footer: footerSchema,
};

export function getSchema(type: ComponentType): ComponentSchema {
  return SCHEMAS[type];
}

/** Deep copy of a type's defaults (new sections must never share objects). */
export function defaultProps(type: ComponentType): Record<string, unknown> {
  return structuredClone(SCHEMAS[type].defaults);
}

export type { HeaderProps } from "./header";
export type { HeroProps } from "./hero";
export type { GalleryProps } from "./gallery";
export type { ProductShowcaseProps } from "./product-showcase";
export type { FeaturesProps, FeatureItem } from "./features";
export type { OffersProps } from "./offers";
export type { TestimonialsProps, TestimonialItem } from "./testimonials";
export type { FaqProps } from "./faq";
export type { OrderFormProps, CustomField, BuiltInField, BuiltInFieldConfig, CustomFieldType } from "./order-form";
export type { FooterProps } from "./footer";
