import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";

const t = ar.sections.faq;
const c = ar.sections.common;

export type FaqProps = {
  title: string;
  subtitle: string;
  first_open: boolean;
  allow_multiple: boolean;
  items: { question: string; answer: string }[];
};

export const faqSchema: ComponentSchema = {
  type: "faq",
  label: t.label,
  description: t.description,
  icon: "message",
  limits: { max: 5 },
  fields: [
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "subtitle", type: "textarea", label: c.subtitle, max: 300, rows: 2 },
    { key: "first_open", type: "toggle", label: t.firstOpen },
    { key: "allow_multiple", type: "toggle", label: t.allowMultiple },
    {
      key: "items",
      type: "repeater",
      label: c.items,
      max: 15,
      itemLabel: t.question,
      titleField: "question",
      newItem: { question: "", answer: "" },
      fields: [
        { key: "question", type: "text", label: t.question, max: 200 },
        { key: "answer", type: "textarea", label: t.answer, max: 1500, rows: 3 },
      ],
    },
  ],
  defaults: {
    title: t.defaults.title,
    subtitle: t.defaults.subtitle,
    first_open: true,
    allow_multiple: false,
    items: [
      { question: t.defaults.q1, answer: t.defaults.a1 },
      { question: t.defaults.q2, answer: t.defaults.a2 },
      { question: t.defaults.q3, answer: t.defaults.a3 },
    ],
  } satisfies FaqProps,
};
