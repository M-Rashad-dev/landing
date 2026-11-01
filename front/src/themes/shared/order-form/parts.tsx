"use client";

import { CheckCircle2, Gift } from "lucide-react";
import type { ReactNode } from "react";
import { formatPrice } from "@/lib/price";
import { activeOffers, describeOffer } from "@/lib/price/offers";
import type { Quote } from "@/lib/types";
import { IconView } from "@/themes/shared/icon-view";
import { OptionSelector, type OptionSelectorClasses } from "@/themes/shared/components/option-selector";
import { QuantityStepper } from "@/themes/shared/components/quantity-stepper";
import type { OrderFormField, OrderFormState } from "@/themes/shared/hooks/order-form-types";
import type { PublicOffer, PublicProduct } from "@/themes/types";
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
  /** Offer picker card (selected or not). */
  offerCard?: (selected: boolean) => string;
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
          {field.choices.map((choice) => {
            const closed = field.kind === "governorate" && state.unavailableGovernorates.includes(choice);
            return (
              <option key={choice} value={choice} disabled={closed}>
                {closed ? `${choice} — ${siteMessages.shippingUnavailable}` : choice}
              </option>
            );
          })}
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

/**
 * Offer picker at the top of the form (order_form.offer_picker): every active offer as a card, plus
 * "one piece, no offer". Picking a card sets the quantity it needs; the server applies the offer.
 */
export function OfferPicker({ product, offers, state, classes = {} }: { product: PublicProduct | null; offers: PublicOffer[]; state: OrderFormState; classes?: FormClasses }) {
  if (!state.offerPicker || !product) return null;
  const cards = activeOffers(offers)
    .map((offer) => describeOffer(offer, product))
    .filter((d) => d !== null)
    .sort((a, b) => b.offer.priority - a.offer.priority || a.quantity - b.quantity);
  if (cards.length === 0) return null;
  const card = (selected: boolean) =>
    cn(
      "relative flex w-full items-center gap-3 rounded-2xl border p-3.5 text-start transition-all",
      selected ? "border-[var(--c-primary)] shadow-[0_0_0_1px_var(--c-primary)]" : "t-border hover:border-[var(--c-primary)]",
      classes.offerCard?.(selected),
    );
  const dot = (selected: boolean) => (
    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-[var(--c-primary)]" : "t-border")} aria-hidden>
      {selected ? <span className="size-2.5 rounded-full bg-[var(--c-primary)]" /> : null}
    </span>
  );

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2 font-bold">{siteMessages.offerPicker.title}</legend>
      <div role="radiogroup" aria-label={siteMessages.offerPicker.title} className="flex flex-col gap-2.5">
        {cards.map((d) => {
          const selected = state.chosenOffer === d.offer.id;
          const detail =
            d.offer.type === "gift" && d.offer.gift
              ? siteMessages.offerPicker.gift(d.offer.gift.name)
              : d.offer.type === "buy_get"
                ? `${siteMessages.pieces(d.quantity)} · ${siteMessages.offerPicker.free(d.offer.free_quantity ?? 1)}`
                : siteMessages.pieces(d.quantity);
          return (
            <button key={d.offer.id} type="button" role="radio" aria-checked={selected} onClick={() => state.chooseOffer(d.offer.id)} className={card(selected)}>
              {dot(selected)}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {d.offer.name}
                  {d.offer.badge_text ? <span className="t-accent rounded-full px-2 py-0.5 text-[11px] font-bold">{d.offer.badge_text}</span> : null}
                </span>
                <span className="t-muted mt-0.5 flex items-center gap-1 text-xs">
                  {d.offer.type === "gift" ? <Gift className="size-3.5 t-primary-text" aria-hidden /> : null}
                  {detail}
                </span>
              </span>
              <span className="shrink-0 text-end">
                <span className="block font-extrabold tabular-nums">{formatPrice(d.total)}</span>
                {d.savings > 0 ? <span className="block text-xs font-semibold text-emerald-600">{siteMessages.save(formatPrice(d.savings))}</span> : null}
              </span>
            </button>
          );
        })}
        <button type="button" role="radio" aria-checked={state.chosenOffer === 0} onClick={() => state.chooseOffer(0)} className={card(state.chosenOffer === 0)}>
          {dot(state.chosenOffer === 0)}
          <span className="flex-1 text-sm font-semibold">{siteMessages.offerPicker.none}</span>
          <span className="shrink-0 font-bold tabular-nums">{formatPrice(product.price)}</span>
        </button>
      </div>
    </fieldset>
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
      {quote.offer && quote.offer.discount > 0 ? row(`${siteMessages.offerDiscount}: ${quote.offer.name}`, `− ${formatPrice(quote.offer.discount)}`, "text-emerald-600") : null}
      {quote.gift ? row(`🎁 ${siteMessages.giftLine(quote.gift.name)}`, siteMessages.shippingFree, "text-emerald-600") : null}
      {quote.offer_error ? <p className="py-1 text-xs font-semibold text-amber-600">{quote.offer_error}</p> : null}
      {quote.code ? row(`${siteMessages.codeDiscount} (${quote.code.code})`, `− ${formatPrice(quote.code.discount)}`, "text-emerald-600") : null}
      {quote.shipping !== undefined
        ? row(siteMessages.shipping, quote.shipping === null ? siteMessages.shippingPick : quote.shipping === 0 ? siteMessages.shippingFree : formatPrice(quote.shipping), quote.shipping === 0 ? "text-emerald-600" : undefined)
        : null}
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
  total,
}: {
  title: string;
  message: string;
  orderNumber: number | null;
  quote: Quote | null;
  className?: string;
  /** Builder preview: no tracking link (there is no real order). */
  preview?: boolean;
  /** Final total from the server (after an accepted post-order offer). */
  total?: number | null;
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
          {siteMessages.total}: <strong className="tabular-nums">{formatPrice(total ?? quote.total)}</strong> — {siteMessages.cod}
        </p>
      ) : null}
    </div>
  );
}

/** Post-order offer under the success message: one click adds it to the same order. */
export function UpsellOfferCard({ state, className, buttonClassName }: { state: OrderFormState; className?: string; buttonClassName?: string }) {
  const offer = state.upsell;
  if (!offer || state.upsellState === "declined") return null;
  const t = siteMessages.upsell;
  const image = offer.product.image?.urls.medium ?? offer.product.image?.urls.thumb;

  if (state.upsellState === "added") {
    return (
      <p className={cn("rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700", className)} role="status">
        {t.added} — {t.newTotal(formatPrice(state.finalTotal ?? 0))}
      </p>
    );
  }

  return (
    <div className={cn("t-tint flex flex-col gap-4 rounded-2xl p-4 text-start sm:flex-row sm:items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- product image from the media volume */}
      {image ? <img src={image} alt={offer.product.name} className="size-20 shrink-0 rounded-xl object-cover" /> : null}
      <div className="min-w-0 flex-1">
        <span className="t-accent inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold">{t.badge}</span>
        <p className="t-heading mt-1.5 font-bold">{offer.headline}</p>
        {offer.description ? <p className="t-muted text-sm">{offer.description}</p> : null}
        <p className="mt-1 text-sm">
          <strong className="tabular-nums">{formatPrice(offer.price)}</strong>
          {offer.regular_price > offer.price ? <span className="t-muted ms-2 tabular-nums line-through">{formatPrice(offer.regular_price)}</span> : null}
        </p>
        {state.upsellState === "failed" ? <p className="mt-1 text-sm text-red-600">{t.failed}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <button type="button" onClick={() => void state.acceptUpsell()} disabled={state.upsellState === "adding"} className={cn("t-primary t-btn h-11 px-5 font-bold transition-transform active:scale-95 disabled:opacity-60", buttonClassName)}>
          {state.upsellState === "adding" ? t.adding : t.add}
        </button>
        <button type="button" onClick={state.declineUpsell} className="t-muted text-xs underline-offset-4 hover:underline">
          {t.decline}
        </button>
      </div>
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
