import type { ComponentSchema } from "@/themes/types";
import { ar } from "@/messages/ar";
import { BUILT_IN_FIELDS, LOCKED_FIELDS, type BuiltInField } from "@/themes/shared/order-form/constants";

const t = ar.sections.order_form;
const c = ar.sections.common;

/** name and phone are always enabled and required. */
export { BUILT_IN_FIELDS, LOCKED_FIELDS, type BuiltInField };

export type BuiltInFieldConfig = { enabled: boolean; required: boolean; label: string; placeholder: string };

export const CUSTOM_FIELD_TYPES = ["text", "textarea", "number", "select", "radio", "checkbox", "date"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export type CustomField = {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  placeholder: string;
  choices: string[];
};

export type OrderFormProps = {
  title: string;
  subtitle: string;
  submit_label: string;
  fields: Record<BuiltInField, BuiltInFieldConfig>;
  custom_fields: CustomField[];
  show_quantity: boolean;
  show_summary: boolean;
  show_code_field: boolean;
  success_title: string;
  success_message: string;
  privacy_note: string;
  trust_badges: { icon: string; text: string }[];
};

const field = (key: BuiltInField, enabled: boolean, required: boolean): BuiltInFieldConfig => ({
  enabled,
  required,
  label: t.builtIn[key],
  placeholder: t.placeholders[key],
});

export const orderFormSchema: ComponentSchema = {
  type: "order_form",
  label: t.label,
  description: t.description,
  icon: "shopping_bag",
  limits: { max: 1 },
  fields: [
    { key: "title", type: "text", label: c.title, max: 120 },
    { key: "subtitle", type: "textarea", label: c.subtitle, max: 300, rows: 2 },
    { key: "submit_label", type: "text", label: t.submitLabel, max: 40 },
    { key: "fields", type: "order_fields", label: t.fields },
    { key: "custom_fields", type: "custom_fields", label: t.customFields, max: 8 },
    { key: "show_quantity", type: "toggle", label: t.showQuantity },
    { key: "show_summary", type: "toggle", label: t.showSummary },
    { key: "show_code_field", type: "toggle", label: t.showCodeField },
    { key: "success_title", type: "text", label: t.successTitle, max: 120 },
    { key: "success_message", type: "textarea", label: t.successMessage, max: 500, rows: 3 },
    { key: "privacy_note", type: "text", label: t.privacyNote, max: 200 },
    {
      key: "trust_badges",
      type: "repeater",
      label: t.trustBadges,
      max: 4,
      itemLabel: c.text,
      titleField: "text",
      newItem: { icon: "shield_check", text: "" },
      fields: [
        { key: "icon", type: "icon", label: c.icon },
        { key: "text", type: "text", label: c.text, max: 40 },
      ],
    },
  ],
  defaults: {
    title: t.defaults.title,
    subtitle: t.defaults.subtitle,
    submit_label: t.defaults.submit,
    fields: {
      name: field("name", true, true),
      phone: field("phone", true, true),
      phone2: field("phone2", false, false),
      governorate: field("governorate", true, true),
      city: field("city", true, false),
      address: field("address", true, true),
      notes: field("notes", true, false),
    },
    custom_fields: [],
    show_quantity: true,
    show_summary: true,
    show_code_field: true,
    success_title: t.defaults.successTitle,
    success_message: t.defaults.successMessage,
    privacy_note: t.defaults.privacy,
    trust_badges: [
      { icon: "wallet", text: t.defaults.b1 },
      { icon: "truck", text: t.defaults.b2 },
    ],
  } satisfies OrderFormProps,
};
