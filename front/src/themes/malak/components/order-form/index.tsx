"use client";

import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import { useOrderForm } from "@/themes/shared/hooks/use-order-form";
import { CodeField, FormNotice, OrderFieldInput, OrderOptions, OrderSummary, QuantityField, SuccessPanel, TrustBadges, type FormClasses } from "@/themes/shared/order-form/parts";
import type { OrderFormProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { cn } from "@/lib/utils";
import { siteMessages } from "@/messages/site";

const CLASSES: FormClasses = {
  input: "rounded-2xl",
  stepper: "t-tint rounded-full p-1",
  stepperButton: "t-bg rounded-full shadow-sm",
  codeButton: "rounded-full",
  option: {
    button: (selected) => cn("min-h-11 rounded-full border px-5 text-sm font-semibold transition-colors", selected ? "t-primary border-transparent" : "t-border hover:border-[var(--c-primary)]"),
    select: "rounded-2xl",
  },
};

export function MalakOrderForm({ props, variant, ctx }: SectionProps<OrderFormProps>) {
  const state = useOrderForm(props, ctx);
  const product = ctx.product;
  const live = !ctx.isPreview;
  const estimated = !live || state.quoteLoading;

  const heading = (
    <div className="mb-8 text-center">
      {props.title ? <h2 className="t-heading text-2xl font-bold md:text-3xl">{props.title}</h2> : null}
      {props.subtitle ? <p className="t-muted mt-2">{props.subtitle}</p> : null}
    </div>
  );

  if (state.status === "success") {
    return (
      <section className="px-4 py-16 md:py-24">
        <div className="t-bg mx-auto max-w-2xl rounded-3xl p-8 shadow-[0_8px_30px_rgba(0,0,0,.08)]">
          <SuccessPanel title={props.success_title} message={props.success_message} orderNumber={state.orderNumber} quote={state.quote} />
        </div>
      </section>
    );
  }

  const fields = (
    <div className="flex flex-col gap-4">
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
      <button type="submit" disabled={state.disabled || state.status === "submitting"} className="t-primary t-btn min-h-14 w-full text-lg font-bold shadow-[0_8px_24px_rgba(0,0,0,.12)] transition-transform hover:-translate-y-0.5 disabled:opacity-60">
        {state.status === "submitting" ? siteMessages.sending : props.submit_label || siteMessages.orderNow}
      </button>
      {props.privacy_note ? <p className="t-muted text-center text-xs">{props.privacy_note}</p> : null}
      <TrustBadges badges={props.trust_badges ?? []} />
    </>
  );
  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void state.submit();
  };

  if (variant === "split-summary") {
    const image = product?.images[0];
    return (
      <section className="t-tint px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          {heading}
          <form onSubmit={onSubmit} onFocus={state.touch} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="t-bg flex min-w-0 flex-col gap-5 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)] sm:p-8">
              {fields}
              {extras}
              <div className="lg:hidden">{props.show_summary ? <OrderSummary quote={state.quote} loading={state.quoteLoading} estimated={estimated} className="t-tint rounded-2xl p-4" /> : null}</div>
              <div className="flex flex-col gap-3 lg:hidden">{submit}</div>
            </div>
            <aside className="t-bg hidden h-fit flex-col gap-5 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)] lg:sticky lg:top-24 lg:flex">
              <h3 className="font-bold">{siteMessages.summary}</h3>
              {product ? (
                <div className="flex items-center gap-3">
                  {image ? <ResponsiveImage image={image} sizes="80px" className="size-20 rounded-2xl object-cover" /> : null}
                  <div>
                    <p className="font-semibold">{product.name}</p>
                    <p className="t-muted text-sm">{Object.keys(state.options).length ? product.options.map((o) => o.values.find((v) => v.id === state.options[o.id])?.label).filter(Boolean).join(" · ") : ""}</p>
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
    <section className="px-4 py-16 md:py-24">
      <form onSubmit={onSubmit} onFocus={state.touch} noValidate className="t-bg mx-auto flex max-w-2xl flex-col gap-5 rounded-3xl border t-border p-6 shadow-[0_8px_30px_rgba(0,0,0,.08)] sm:p-10">
        {heading}
        {fields}
        {extras}
        {props.show_summary ? <OrderSummary quote={state.quote} loading={state.quoteLoading} estimated={estimated} className="t-tint rounded-2xl p-4" /> : null}
        {submit}
      </form>
    </section>
  );
}
