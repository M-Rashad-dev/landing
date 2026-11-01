"use client";

import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import { useOrderForm } from "@/themes/shared/hooks/use-order-form";
import { CodeField, FormNotice, OfferPicker, OrderFieldInput, OrderOptions, OrderSummary, QuantityField, SuccessPanel, TrustBadges, UpsellOfferCard, type FormClasses } from "@/themes/shared/order-form/parts";
import type { OrderFormProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";

const CLASSES: FormClasses = {
  input: "rounded-xl border-white/15 bg-white/5",
  stepper: "l-glass rounded-full p-1",
  stepperButton: "rounded-full bg-white/10",
  codeButton: "rounded-xl",
  option: {
    button: (selected) => cn("min-h-11 rounded-xl border px-5 text-sm font-semibold transition-all", selected ? "t-primary border-transparent shadow-[0_8px_24px_-8px_var(--c-primary)]" : "border-white/15 bg-white/5 hover:border-[var(--c-primary)]"),
    select: "rounded-xl border-white/15 bg-white/5",
  },
};

/** «ليالي» order form: one glass card, or a split layout with a sticky summary of the chosen product. */
export function LayaliOrderForm({ props, variant, ctx }: SectionProps<OrderFormProps>) {
  const state = useOrderForm(props, ctx);
  const product = ctx.product;
  const estimated = ctx.isPreview || state.quoteLoading;

  const heading = (
    <div className="mb-8 text-center">
      {props.title ? <h2 className="t-heading l-grad-text text-3xl font-bold md:text-4xl">{props.title}</h2> : null}
      {props.subtitle ? <p className="t-muted mt-3">{props.subtitle}</p> : null}
    </div>
  );

  if (state.status === "success") {
    return (
      <section className="relative px-4 py-20 md:py-28">
        <div className="l-glass mx-auto max-w-2xl rounded-[2rem] p-8">
          <SuccessPanel title={props.success_title} message={props.success_message} orderNumber={state.orderNumber} quote={state.quote} preview={ctx.isPreview} total={state.finalTotal} />
          <UpsellOfferCard state={state} className="l-glass rounded-2xl" buttonClassName="l-glow-btn" />
        </div>
      </section>
    );
  }

  const fields = (
    <div className="flex flex-col gap-4">
      <OfferPicker product={product} offers={ctx.offers} state={state} classes={CLASSES} />
      {state.fields.map((field) => (
        <OrderFieldInput key={field.name} field={field} state={state} classes={CLASSES} />
      ))}
    </div>
  );
  const extras = (
    <>
      <OrderOptions product={product} state={state} classes={CLASSES} />
      {props.show_quantity ? <QuantityField state={state} classes={CLASSES} /> : null}
      {props.show_code_field ? <CodeField state={state} classes={CLASSES} /> : null}
    </>
  );
  const submit = (
    <>
      <FormNotice state={state} />
      <button type="submit" disabled={state.disabled || state.status === "submitting"} className="t-primary t-btn l-glow-btn min-h-14 w-full text-lg font-bold disabled:opacity-60">
        {state.status === "submitting" ? siteMessages.sending : props.submit_label || siteMessages.orderNow}
      </button>
      {props.privacy_note ? <p className="t-muted text-center text-xs">{props.privacy_note}</p> : null}
      <TrustBadges badges={props.trust_badges ?? []} itemClassName="text-[var(--c-fg)]" />
    </>
  );
  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void state.submit();
  };

  if (variant === "split-luxe") {
    const image = product?.images[0];
    return (
      <section className="relative px-4 py-20 md:py-28">
        <div className="l-aurora opacity-50" aria-hidden />
        <div className="relative mx-auto max-w-6xl">
          {heading}
          <form onSubmit={onSubmit} onFocus={state.touch} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="l-glass flex min-w-0 flex-col gap-5 rounded-[2rem] p-6 sm:p-8">
              {fields}
              {extras}
              <div className="lg:hidden">{props.show_summary ? <OrderSummary quote={state.quote} loading={state.quoteLoading} estimated={estimated} className="rounded-2xl bg-white/5 p-4" /> : null}</div>
              <div className="flex flex-col gap-3 lg:hidden">{submit}</div>
            </div>
            <aside className="l-glass hidden h-fit flex-col gap-5 rounded-[2rem] p-6 lg:sticky lg:top-24 lg:flex">
              {product ? (
                <div className="flex items-center gap-4">
                  {image ? <ResponsiveImage image={image} sizes="88px" className="size-22 rounded-2xl object-cover ring-1 ring-white/10" /> : null}
                  <div>
                    <p className="t-heading font-bold">{product.name}</p>
                    <p className="t-muted text-sm">{Object.keys(state.options).length ? product.options.map((o) => o.values.find((v) => v.id === state.options[o.id])?.label).filter(Boolean).join(" · ") : siteMessages.summary}</p>
                  </div>
                </div>
              ) : null}
              {props.show_summary ? <OrderSummary quote={state.quote} loading={state.quoteLoading} estimated={estimated} /> : null}
              {submit}
            </aside>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="relative mx-auto max-w-2xl rounded-[2.25rem] p-[1px]" style={{ background: "linear-gradient(140deg, color-mix(in srgb, var(--c-primary) 70%, transparent), transparent 40%, color-mix(in srgb, var(--c-accent) 60%, transparent))" }}>
        <form onSubmit={onSubmit} onFocus={state.touch} noValidate className="flex flex-col gap-5 rounded-[2.2rem] p-6 sm:p-10" style={{ background: "color-mix(in srgb, var(--c-bg) 94%, var(--c-primary))" }}>
          {heading}
          {fields}
          {extras}
          {props.show_summary ? <OrderSummary quote={state.quote} loading={state.quoteLoading} estimated={estimated} className="rounded-2xl bg-white/5 p-4" /> : null}
          {submit}
        </form>
      </div>
    </section>
  );
}
