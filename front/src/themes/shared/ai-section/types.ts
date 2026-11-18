import type { ProductCard } from "@/themes/store/shared/types";

export type AiFieldType =
  | "text"
  | "textarea"
  | "image"
  | "images"
  | "link"
  | "color"
  | "number"
  | "toggle"
  | "date"
  | "products"
  | "categories"
  | "list";

export type AiColorDefault = "primary" | "secondary" | "text" | "background";

export type AiField = {
  key: string;
  type: AiFieldType;
  label: string;
  hint?: string;
  sample?: unknown;
  max?: number;
  min?: number;
  default?: AiColorDefault;
  fields?: AiField[];
};

export type AiDefinition = {
  id: number;
  name: string;
  html: string;
  css: string;
  fields: AiField[];
};

export type AiTokens = {
  primary: string;
  secondary: string;
  bg: string;
  text: string;
  onPrimary: string;
  muted: string;
  border: string;
  fontBody: string;
  fontDisplay: string;
  radius: string;
};

export type AiSectionProps = {
  ai_section_id: number;
  values: Record<string, unknown>;
  version_id?: number;
};

export type AiCategoryTile = {
  id: number;
  name: string;
  slug: string;
  image: { urls: Record<string, string> } | null;
  products_count: number;
};

export type AiRenderProduct = {
  name: string;
  price: number;
  compare_at_price?: number | null;
  image?: string | null;
};

export type AiSectionRuntimeData = {
  products?: Record<string, ProductCard[]>;
  categories?: Record<string, AiCategoryTile[]>;
  links?: Record<string, string | null>;
  media?: Record<string, Record<string, string>>;
  landingProduct?: AiRenderProduct | null;
};

