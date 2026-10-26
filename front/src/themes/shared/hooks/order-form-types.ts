import type { Quote } from "@/lib/types";

/**
 * Contract of useOrderForm(), shared by every theme's order form.
 * Themes only render; all state, validation, pricing and submission live in the hook.
 */
export type OrderFieldKind = "text" | "textarea" | "number" | "select" | "radio" | "checkbox" | "date" | "tel" | "governorate";

export type OrderFormField = {
  /** "customer.name" style path for built-ins, "answers.<key>" for custom fields. */
  name: string;
  kind: OrderFieldKind;
  label: string;
  placeholder: string;
  required: boolean;
  choices: string[];
  autoComplete?: string;
  inputMode?: "text" | "tel" | "numeric" | "email";
};

export type OrderFormStatus = "idle" | "submitting" | "success" | "error";

export type OrderFormState = {
  fields: OrderFormField[];
  values: Record<string, string | boolean>;
  setValue: (name: string, value: string | boolean) => void;
  errors: Record<string, string>;
  /** option_id → value_id */
  options: Record<number, number>;
  setOption: (optionId: number, valueId: number) => void;
  quantity: number;
  setQuantity: (quantity: number) => void;
  code: string;
  setCode: (code: string) => void;
  applyCode: () => void;
  /** Latest server quote (or the local estimate while it loads). */
  quote: Quote | null;
  quoteLoading: boolean;
  status: OrderFormStatus;
  /** Shown above the submit button (network error, generic rejection...). */
  formError: string | null;
  orderNumber: number | null;
  submit: () => Promise<void>;
  /** Fired once on first interaction (InitiateCheckout). */
  touch: () => void;
  disabled: boolean;
  disabledReason: string | null;
};
