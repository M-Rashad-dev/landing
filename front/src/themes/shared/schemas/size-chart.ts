import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.size_chart;
const c = ar.sections.common;

export type SizeRow = { size: string; col1: string; col2: string; col3: string };

export type SizeChartProps = {
  title: string;
  note: string;
  size_label: string;
  col1_label: string;
  col2_label: string;
  col3_label: string;
  rows: SizeRow[];
};

export const sizeChartSchema: ComponentSchema = {
  type: "size_chart",
  label: t.label,
  description: t.description,
  icon: "ruler",
  limits: { max: 3 },
  fields: [
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "size_label", type: "text", label: t.sizeLabel, max: 30 },
    { key: "col1_label", type: "text", label: t.colLabel(1), max: 30 },
    { key: "col2_label", type: "text", label: t.colLabel(2), max: 30 },
    { key: "col3_label", type: "text", label: t.colLabel(3), max: 30 },
    {
      key: "rows",
      type: "repeater",
      label: t.rows,
      max: 12,
      itemLabel: t.size,
      titleField: "size",
      newItem: { size: "", col1: "", col2: "", col3: "" },
      fields: [
        { key: "size", type: "text", label: t.size, max: 20 },
        { key: "col1", type: "text", label: t.col(1), max: 30 },
        { key: "col2", type: "text", label: t.col(2), max: 30 },
        { key: "col3", type: "text", label: t.col(3), max: 30 },
      ],
    },
    { key: "note", type: "textarea", label: t.note, max: 300, rows: 2 },
  ],
  defaults: {
    title: t.defaults.title,
    note: t.defaults.note,
    size_label: t.defaults.size,
    col1_label: t.defaults.c1,
    col2_label: t.defaults.c2,
    col3_label: t.defaults.c3,
    rows: [
      { size: "M", col1: "96 - 100", col2: "70", col3: "60 - 70 كجم" },
      { size: "L", col1: "100 - 106", col2: "72", col3: "70 - 80 كجم" },
      { size: "XL", col1: "106 - 112", col2: "74", col3: "80 - 90 كجم" },
      { size: "2XL", col1: "112 - 118", col2: "76", col3: "90 - 105 كجم" },
    ],
  } satisfies SizeChartProps,
};
