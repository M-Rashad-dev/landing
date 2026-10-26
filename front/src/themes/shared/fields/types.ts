import type { FieldDef, Section } from "@/themes/types";

export type FieldContext = {
  /** Current page sections (link field offers them as anchors). */
  sections: Section[];
  /** Unique id prefix for labels/inputs. */
  idPrefix: string;
};

export type FieldProps<V = unknown, F extends FieldDef = FieldDef> = {
  field: F;
  value: V;
  onChange: (value: V) => void;
  ctx: FieldContext;
  id: string;
};
