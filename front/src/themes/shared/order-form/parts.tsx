"use client";

import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { formatPrice } from "@/lib/price";
import type { Quote } from "@/lib/types";
import { IconView } from "@/themes/shared/icon-view";
import { OptionSelector, type OptionSelectorClasses } from "@/themes/shared/components/option-selector";
import { QuantityStepper } from "@/themes/shared/components/quantity-stepper";
import type { OrderFormField, OrderFormState } from "@/themes/shared/hooks/order-form-types";
import type { PublicProduct } from "@/themes/types";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";

export type FormClasses = {
  label?: string;
  input?: string;
  error?: string;
  option?: OptionSelectorClasses;
  stepper?: string;
  stepperButton?: string;
  codeButton?: string;
  summary?: string;
  summaryTotal?: string;
};

const domId = (name: string) => `of-${name.replace(/[^a-z0-9_]/gi, "-")}`;

export function OrderFieldInput({ field, state, classes = {} }: { field: OrderFormField; state: OrderFormState; classes?: FormClasses }) {
  const id = domId(field.name);
  const value = state.values[field.name];
  const error = state.errors[field.name];
  const common = {
    id,
    "data-field": field.name,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${id}-error` : undefined,
    disabled: state.disabled || state.status === "submitting",
  };
  const inputClass = cn("t-input w-full rounded-lg px-3", classes.input);

  let control: ReactNode;
  switch (field.kind) {
    case "textarea":
      control = <textarea {...common} rows={3} placeholder={field.placeholder} autoComplete={field.autoComplete} value={typeof value === "string" ? value : ""} onChange={(e) => state.setValue(field.name, e.target.value)} className={cn(inputClass, "py-2.5")} />;
      break;
    case "governorate":
    case "select":
      control = (
        <select {...common} value={typeof value === "string" ? value : ""} onChange={(e) => state.setValue(field.name, e.target.value)} autoComplete={field.autoComplete} className={cn(inputClass, "h-12")}>
          <option value="">{field.placeholder || siteMessages.choose}</option>
          {field.choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      );
      break;
    case "radio":
      control = (
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-labelledby={`${id}-label`} data-field={field.name} tabIndex={-1}>
          {field.choices.map((choice) => (
            <label key={choice} className="flex items-center gap-2 text-sm">
              <input type="radio" name={id} value={choice} checked={value === choice} onChange={() => state.setValue(field.name, choice)} className="size-4 accent-[var(--c-primary)]" disabled={common.disabled} />
              {choice}
            </label>
          ))}
        </div>
      );
      break;
    case "checkbox":
      return (
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...common} checked={value === true} onChange={(e) => state.setValue(field.name, e.target.checked)} className="size-5 accent-[var(--c-primary)]" />
            <span>
              {field.label}
              {field.required ? <span className="text-red-600"> *</span> : null}
            </span>
          </label>
          {error ? (
            <p id={`${id}-error`} role="alert" className={cn("text-sm text-red-600", classes.error)}>
              {error}
            </p>
          ) : null}
        </div>
      );
    default:
      control = (
        <input
          {...common}
          type={field.kind === "tel" ? "tel" : field.kind === "number" ? "text" : field.kind === "date" ? "date" : "text"}
          inputMode={field.inputMode}
          dir={field.kind === "tel" || field.kind === "number" ? "ltr" : undefined}
          placeholder={field.placeholder}
          autoComplete={field.autoComplete}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => state.setValue(field.name, e.target.value)}
          className={cn(inputClass, "h-12", field.kind === "tel" && "text-start")}
        />
      );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label id={`${id}-label`} htmlFor={id} className={cn("text-sm font-semibold", classes.label)}>
        {field.label}
        {field.required ? <span className="text-red-600"> *</span> : null}
      </label>
      {control}
      {error ? (
        <p id={`${id}-error`} role="alert" className={cn("text-sm text-red-600", classes.error)}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function OrderOptions({ product, state, classes = {} }: { product: PublicProduct | null; state: OrderFormState; classes?: FormClasses }) {
  if (!product || product.options.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {product.options.map((option) => (
        <div key={option.id} data-field={`options.${option.id}`} tabIndex={-1}>
          <OptionSelector option={option} value={state.options[option.id]} onChange={(valueId) => state.setOption(option.id, valueId)} error={state.errors[`options.${option.id}`]} classes={classes.option} disabled={state.disabled} />
        </div>
      ))}
    </div>
  );
}

export function QuantityField({ state, classes = {} }: { state: OrderFormState; classes?: FormClasses }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("text-sm font-semibold", classes.label)}>{siteMessages.quantity}</span>
      <QuantityStepper value={state.quantity} onChange={state.setQuantity} className={classes.stepper} buttonClassName={classes.stepperButton} disabled={state.disabled} />
    </div>
  );
}

export function CodeField({ state, classes = {} }: { state: OrderFormState; classes?: FormClasses }) {
  const error = state.errors.code;
  const applied = state.quote?.code;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="of-code" className={cn("text-sm font-semibold", classes.label)}>
        {siteMessages.code}
      </label>
      <div className="flex gap-2">
        <input
          id="of-code"
          data-field="code"
          dir="ltr"
          value={state.code}
          onChange={(e) => state.setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              state.applyCode();
            }
          }}
          placeholder={siteMessages.codePlaceholder}
          className={cn("t-input h-12 min-w-0 flex-1 rounded-lg px-3 uppercase", classes.input)}
          aria-invalid={Boolean(error)}
          disabled={state.disabled}
        />
        <button type="button" onClick={state.applyCode} disabled={state.disabled || !state.code.trim()} className={cn("t-primary t-btn h-12 shrink-0 px-5 text-sm font-bold disabled:opacity-50", classes.codeButton)}>
          {siteMessages.apply}
        </button>
      </div>
      {error ? (
        <p role="alert" className={cn("text-sm text-red-600", classes.error)}>
          {error}
        </p>
      ) : applied ? (
        <p className="text-sm font-semibold text-emerald-600">
          {applied.code}: −{formatPrice(applied.discount)}
        </p>
      ) : null}
    </div>
  );
}

export function OrderSummary({ quote, loading, estimated, className, totalClassName }: { quote: Quote | null; loading: boolean; estimated: boolean; className?: string; totalClassName?: string }) {
  if (!quote) return null;
  const row = (label: string, value: string, extra?: string) => (
    <div className={cn("flex items-center justify-between gap-3 py-1.5 text-sm", extra)}>
      <span className="t-muted">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className={cn("flex flex-col", className)} aria-live="polite" aria-busy={loading}>
      {row(`${siteMessages.subtotal} (${quote.quantity} × ${formatPrice(quote.unit_price)})`, formatPrice(quote.base_subtotal))}
      {quote.offer ? row(`${siteMessages.offerDiscount}: ${quote.offer.name}`, `− ${formatPrice(quote.offer.discount)}`, "text-emerald-600") : null}
      {quote.code ? row(`${siteMessages.codeDiscount} (${quote.code.code})`, `− ${formatPrice(quote.code.discount)}`, "text-emerald-600") : null}
      <div className={cn("mt-1 flex items-center justify-between gap-3 border-t pt-3 t-border", totalClassName)}>
        <span className="font-bold">{siteMessages.total}</span>
        <span className={cn("text-xl font-extrabold tabular-nums", loading && "opacity-60")}>{formatPrice(quote.total)}</span>
      </div>
      <p className="t-muted mt-1 text-xs">{estimated ? siteMessages.estimate : siteMessages.cod}</p>
    </div>
  );
}

export function TrustBadges({ badges, className, itemClassName }: { badges: { icon: string; text: string }[]; className?: string; itemClassName?: string }) {
  const visible = badges.filter((b) => b.text?.trim());
  if (visible.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap justify-center gap-3", className)}>
      {visible.map((badge, i) => (
        <li key={i} className={cn("flex items-center gap-1.5 text-xs font-semibold", itemClassName)}>
          <IconView name={badge.icon} className="size-4 t-primary-text" />
          {badge.text}
        </li>
      ))}
    </ul>
  );
}

export function SuccessPanel({
  title,
  message,
  orderNumber,
  quote,
  className,
  preview = false,
}: {
  title: string;
  message: string;
  orderNumber: number | null;
  quote: Quote | null;
  className?: string;
  /** Builder preview: no tracking link (there is no real order). */
  preview?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-8 text-center", className)} role="status" aria-live="polite">
      <CheckCircle2 className="size-14 text-emerald-500" aria-hidden />
      <h3 className="t-heading text-2xl font-extrabold">{title}</h3>
      {message ? <p className="t-muted max-w-md leading-relaxed">{message}</p> : null}
      {orderNumber ? <p className="rounded-full bg-black/5 px-4 py-1.5 font-bold tabular-nums">{siteMessages.orderNumber(orderNumber)}</p> : null}
      {orderNumber && !preview ? (
        <a href={`/track?order=${orderNumber}`} className="t-primary-text text-sm font-semibold underline-offset-4 hover:underline">
          {siteMessages.track.link}
        </a>
      ) : null}
      {quote ? (
        <p className="text-sm">
          {siteMessages.total}: <strong className="tabular-nums">{formatPrice(quote.total)}</strong> — {siteMessages.cod}
        </p>
      ) : null}
    </div>
  );
}

export function FormNotice({ state }: { state: OrderFormState }) {
  if (state.disabledReason) return <p className="rounded-lg bg-amber-100 px-3 py-2 text-center text-sm font-semibold text-amber-900">{state.disabledReason}</p>;
  if (state.formError) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-700">
        {state.formError}
      </p>
    );
  }
  return null;
}
