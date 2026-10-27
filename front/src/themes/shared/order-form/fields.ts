import { z } from "zod";
import { isValidPhone } from "@/lib/format/phone";
import { GOVERNORATES } from "@/lib/governorates";
import { BUILT_IN_FIELDS, LOCKED_FIELDS, type BuiltInField } from "@/themes/shared/order-form/constants";
import type { OrderFormProps } from "@/themes/shared/schemas/order-form";
import type { OrderFormField } from "@/themes/shared/hooks/order-form-types";
import { orderFieldLabels, siteMessages } from "@/messages/site";

const t = siteMessages;

/** Length limits shared with the back end (7.3). */
export const LIMITS = { name: [2, 80], address: [0, 300], notes: [0, 500], city: [0, 100], text: [0, 200], textarea: [0, 1000] } as const;

const BUILT_IN_KIND: Record<BuiltInField, Pick<OrderFormField, "kind" | "autoComplete" | "inputMode">> = {
  name: { kind: "text", autoComplete: "name" },
  phone: { kind: "tel", autoComplete: "tel", inputMode: "tel" },
  phone2: { kind: "tel", autoComplete: "tel", inputMode: "tel" },
  governorate: { kind: "governorate", autoComplete: "address-level1" },
  city: { kind: "text", autoComplete: "address-level2" },
  address: { kind: "textarea", autoComplete: "street-address" },
  notes: { kind: "textarea" },
};

/** Visible fields from the published order_form settings (enabled built-ins + custom fields). */
export function buildFields(props: Pick<OrderFormProps, "fields" | "custom_fields">): OrderFormField[] {
  const fields: OrderFormField[] = [];
  for (const key of BUILT_IN_FIELDS) {
    const config = props.fields?.[key];
    const locked = LOCKED_FIELDS.includes(key);
    if (!locked && !config?.enabled) continue;
    fields.push({
      name: `customer.${key}`,
      label: config?.label || orderFieldLabels[key],
      placeholder: config?.placeholder ?? "",
      required: locked || Boolean(config?.required),
      choices: key === "governorate" ? [...GOVERNORATES] : [],
      ...BUILT_IN_KIND[key],
    });
  }
  for (const custom of props.custom_fields ?? []) {
    if (!custom?.key || !/^[a-z][a-z0-9_]{0,59}$/.test(custom.key)) continue;
    fields.push({
      name: `answers.${custom.key}`,
      kind: custom.type,
      label: custom.label,
      placeholder: custom.placeholder ?? "",
      required: Boolean(custom.required),
      choices: (custom.choices ?? []).map((c) => c.trim()).filter(Boolean),
      inputMode: custom.type === "number" ? "numeric" : undefined,
    });
  }
  return fields;
}

function lengthFor(field: OrderFormField): readonly [number, number] {
  const key = field.name.split(".")[1] as keyof typeof LIMITS;
  if (field.name.startsWith("customer.") && key in LIMITS) return LIMITS[key];
  return field.kind === "textarea" ? LIMITS.textarea : LIMITS.text;
}

/** Validate one value; returns an Arabic message or null (mirror of the back-end rules). */
export function validateField(field: OrderFormField, raw: string | boolean | undefined): string | null {
  if (field.kind === "checkbox") {
    return field.required && raw !== true ? t.required : null;
  }
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return field.required ? t.required : null;

  switch (field.kind) {
    case "tel":
      return isValidPhone(value) ? null : t.invalidPhone;
    case "number":
      return /^-?\d+(\.\d+)?$/.test(value) ? null : t.invalidNumber;
    case "governorate":
    case "select":
    case "radio":
      return field.choices.includes(value) ? null : t.required;
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? null : t.required;
    default: {
      const [min, max] = lengthFor(field);
      if (value.length < min) return t.tooShort(min);
      if (value.length > max) return t.tooLong(max);
      return null;
    }
  }
}

/**
 * zod schema for the whole form, generated from the settings (same rules as validateField).
 * Rules run on the object so missing keys are checked too (a per-key refine would skip them).
 */
export function buildSchema(fields: OrderFormField[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) shape[field.name] = z.any().optional();
  return z.object(shape).superRefine((values, ctx) => {
    for (const field of fields) {
      const message = validateField(field, values[field.name] as string | boolean | undefined);
      if (message) ctx.addIssue({ code: "custom", message, path: [field.name] });
    }
  });
}

export function validateAll(fields: OrderFormField[], values: Record<string, string | boolean>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const message = validateField(field, values[field.name]);
    if (message) errors[field.name] = message;
  }
  return errors;
}
