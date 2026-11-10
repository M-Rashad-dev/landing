import type { FieldDef, Section } from "@/themes/types";

export type FieldContext = {
  /** Current page sections (link field offers them as anchors). */
  sections: Section[];
  /** Unique id prefix for labels/inputs. */
  idPrefix: string;
  /** Store home only: the store categories (category pickers, store links). */
  categories?: Array<{ id: number; name: string; slug: string; depth: number }>;
};

export type FieldProps<V = unknown, F extends FieldDef = FieldDef> = {
  field: F;
  value: V;
  onChange: (value: V) => void;
  ctx: FieldContext;
  id: string;
};
