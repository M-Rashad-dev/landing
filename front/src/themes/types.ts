import type { ComponentType as ReactComponentType } from "react";

export const COMPONENT_TYPES = [
  "header",
  "hero",
  "gallery",
  "product_showcase",
  "features",
  "offers",
  "testimonials",
  "faq",
  "order_form",
  "footer",
] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

export function isComponentType(value: unknown): value is ComponentType {
  return typeof value === "string" && (COMPONENT_TYPES as readonly string[]).includes(value);
}

/* ---------- Page content (stored as JSON) ---------- */

export type Section<P = Record<string, unknown>> = {
  id: string;
  type: ComponentType;
  variant: string;
  visible: boolean;
  props: P;
};

/** Page-only identity look chosen in the builder ("هوية خاصة بالصفحة"), drawn over the page identity. */
export type PageDesign = {
  colors: Partial<PublicIdentity["colors"]>;
  font_heading: string;
  font_body: string;
  button_radius: PublicIdentity["button_radius"];
};

export type PageContent = { version: 1; sections: Section[]; design?: PageDesign };

/* ---------- Public data given to themes ---------- */

export type PublicImage = { id: number; alt: string | null; width: number; height: number; urls: { thumb: string; medium: string; large: string } };

export type PublicIdentity = {
  brand_name: string;
  colors: Record<"primary" | "primary_foreground" | "secondary" | "accent" | "background" | "foreground" | "muted" | "border", string>;
  font_heading: string;
  font_body: string;
  button_radius: "none" | "sm" | "md" | "lg" | "full";
  logo: PublicImage | null;
  favicon: { icon32: string; icon180: string } | null;
  og_image: PublicImage | null;
  seo_title: string | null;
  seo_title_suffix: string | null;
  seo_description: string | null;
  contact: { phone: string | null; whatsapp: string | null; email: string | null; address: string | null };
  socials: Record<"facebook" | "instagram" | "tiktok" | "youtube" | "x" | "snapchat", string | null>;
};

export type PublicOptionValue = { id: number; label: string; color_hex: string | null; price_delta: number };
export type PublicOption = { id: number; name: string; display_type: "buttons" | "dropdown" | "swatch"; is_required: boolean; values: PublicOptionValue[] };

export type PublicProduct = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  available: boolean;
  images: PublicImage[];
  options: PublicOption[];
};

export type PublicOffer = {
  id: number;
  name: string;
  type: "percentage" | "fixed" | "bundle";
  value: number | null;
  bundle_quantity: number | null;
  bundle_price: number | null;
  starts_at: string | null;
  ends_at: string | null;
  status: "active" | "scheduled";
  badge_text: string | null;
  priority: number;
};

export interface PageContext {
  host: string;
  isPreview: boolean;
  identity: PublicIdentity;
  product: PublicProduct | null;
  offers: PublicOffer[];
  page: { id: number; slug: string; title: string };
  /** All media referenced by the content, resolved by id (images live outside props). */
  media: Record<number, PublicImage>;
  /** Event fired after a successful order (identity/page tracking setting). */
  conversionEvent?: "Lead" | "Purchase";
  /** Store delivery fees (the server quote stays the authority). */
  shipping?: PublicShipping;
}

export type PublicShipping = { enabled: false } | { enabled: true; fees: Record<string, number>; unavailable: string[]; free_over: number | null };

export interface SectionProps<P = Record<string, unknown>> {
  sectionId: string;
  props: P;
  variant: string;
  ctx: PageContext;
}

/* ---------- Theme registry ---------- */

export interface ThemeComponentDef {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each type has its own props shape
  component: ReactComponentType<SectionProps<any>>;
  variants: { key: string; label: string }[];
  defaultVariant: string;
  /** Small wireframe SVG for the Builder library. */
  Thumbnail: ReactComponentType;
}

export interface ThemeDef {
  key: string;
  name: string;
  description: string;
  components: Record<ComponentType, ThemeComponentDef>;
  /** Default order for a new page. */
  starterSections: { type: ComponentType; variant: string }[];
}

/* ---------- Schemas (drive the Builder forms) ---------- */

type BaseField = {
  key: string;
  label: string;
  hint?: string;
  /** Show only when another field (same level) has this value. */
  showIf?: { field: string; equals: unknown };
};

export type SelectOption = { value: string; label: string };

export type FieldDef =
  | (BaseField & { type: "text"; max: number; placeholder?: string })
  | (BaseField & { type: "textarea"; max: number; rows?: number; placeholder?: string })
  | (BaseField & { type: "number"; min: number; max: number; step?: number })
  | (BaseField & { type: "range"; min: number; max: number; step?: number; unit?: string })
  | (BaseField & { type: "toggle" })
  | (BaseField & { type: "select"; options: SelectOption[] })
  | (BaseField & { type: "color" })
  | (BaseField & { type: "image" })
  | (BaseField & { type: "images"; max: number })
  | (BaseField & { type: "link" })
  | (BaseField & { type: "icon" })
  | (BaseField & { type: "repeater"; min?: number; max: number; fields: FieldDef[]; itemLabel: string; titleField?: string; newItem: Record<string, unknown> })
  | (BaseField & { type: "group"; fields: FieldDef[]; collapsible?: boolean })
  | (BaseField & { type: "order_fields" })
  | (BaseField & { type: "custom_fields"; max: number });

export type FieldType = FieldDef["type"];

export interface ComponentSchema {
  type: ComponentType;
  label: string;
  description: string;
  /** Key in the shared icon set. */
  icon: string;
  fields: FieldDef[];
  defaults: Record<string, unknown>;
  limits: { max: number; singleton?: boolean; pinned?: "top" | "bottom" };
}
