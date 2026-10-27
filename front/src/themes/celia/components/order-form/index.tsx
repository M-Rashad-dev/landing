"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/price";
import { ResponsiveImage } from "@/themes/shared/components/responsive-image";
import { useOrderForm } from "@/themes/shared/hooks/use-order-form";
import { CodeField, FormNotice, OrderFieldInput, OrderOptions, OrderSummary, QuantityField, SuccessPanel, TrustBadges, type FormClasses } from "@/themes/shared/order-form/parts";
import type { OrderFormProps } from "@/themes/shared/schemas";
import type { SectionProps } from "@/themes/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const CLASSES: FormClasses = {
  input: "rounded-none border-2 border-[var(--c-fg)]",
  label: "font-extrabold uppercase",
  stepper: "border-2 t-line",
  stepperButton: "border-[var(--c-fg)]",
  codeButton: "rounded-none border-2 t-line",
  option: {
    button: (selected) => cn("min-h-11 border-2 px-4 text-sm font-extrabold", selected ? "t-inverse t-line" : "t-line"),
    swatch: (selected) => cn("relative flex size-11 items-center justify-center border-2 t-line", selected && "shadow-[3px_3px_0_var(--c-fg)] outline outline-2 outline-offset-2 outline-[var(--c-fg)]"),
    select: "rounded-none border-2 border-[var(--c-fg)]",
    label: "font-extrabold uppercase",
  },
};

/** Mobile-only bottom bar: total + "order now", visible while the form is off screen. */
function MobileBar({ target, total, label }: { target: React.RefObject<HTMLElement | null>; total: number | null; label: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), { threshold: 0.05 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);
  if (!visible || total === null) return null;
  return (
    <div className="t-inverse fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t-[3px] border-[var(--c-bg)] px-4 py-3 md:hidden">
      <span className="text-2xl font-black tabular-nums">{formatPrice(total)}</span>
      <button type="button" onClick={() => target.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="t-accent t-btn border-2 border-[var(--c-bg)] px-6 py-2.5 font-black">
        {label}
      </button>
    </div>
  );
}

export function CeliaOrderForm({ props, variant, ctx }: SectionProps<OrderFormProps>) {
  const state = useOrderForm(props, ctx);
  const product = ctx.product;
  const formRef = useRef<HTMLFormElement>(null);
  const estimated = ctx.isPreview || state.quoteLoading;

  const heading = (
    <div className="mb-8">
      {props.title ? <h2 className="t-heading text-3xl font-black uppercase leading-tight tracking-tight md:text-5xl">{props.title}</h2> : null}
      {props.subtitle ? <p className="t-muted mt-2">{props.subtitle}</p> : null}
    </div>
  );

  if (state.status === "success") {
    return (
      <section className="t-bg border-t-[3px] t-line px-4 py-12 md:py-16">
        <div className="t-hard mx-auto max-w-2xl p-6">
          <SuccessPanel title={props.success_title} message={props.success_message} orderNumber={state.orderNumber} quote={state.quote} />
        </div>
      </section>
    );
  }

  const body = (
    <>
      <div className="flex flex-col gap-4">
        {state.fields.map((field) => (
          <OrderFieldInput key={field.name} field={field} state={state} classes={CLASSES} />
        ))}
      </div>
      <OrderOptions product={product} state={state} classes={CLASSES} />
      {props.show_quantity ? <QuantityField state={state} classes={CLASSES} /> : null}
      {props.show_code_field ? <CodeField state={state} classes={CLASSES} /> : null}
    </>
  );
  const submit = (
    <>
      <FormNotice state={state} />
      <button type="submit" disabled={state.disabled || state.status === "submitting"} className="t-inverse t-btn t-press min-h-16 w-full border-2 t-line text-xl font-black uppercase shadow-[4px_4px_0_var(--c-primary)] disabled:opacity-60">
        {state.status === "submitting" ? ar.site.sending : props.submit_label || ar.site.orderNow}
      </button>
      {props.privacy_note ? <p className="t-muted text-center text-xs">{props.privacy_note}</p> : null}
      <TrustBadges badges={props.trust_badges ?? []} itemClassName="border-2 t-line px-2 py-1" />
    </>
  );
  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void state.submit();
  };

  if (variant === "sticky-summary") {
    const image = product?.images[0];
    return (
      <section className="t-bg border-t-[3px] t-line px-4 py-12 pb-24 md:py-16">
        <div className="mx-auto max-w-6xl">
          {heading}
          <form ref={formRef} onSubmit={onSubmit} onFocus={state.touch} noValidate className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-5">
              {body}
              <div className="lg:hidden">{props.show_summary ? <OrderSummary quote={state.quote} loading={state.quoteLoading} estimated={estimated} className="border-2 t-line p-4" /> : null}</div>
              <div className="flex flex-col gap-3 lg:hidden">{submit}</div>
            </div>
            <aside className="t-hard hidden h-fit flex-col gap-5 p-6 lg:sticky lg:top-24 lg:flex">
              <h3 className="text-lg font-black uppercase">{ar.site.summary}</h3>
              {product ? (
                <div className="flex items-center gap-3 border-b-2 t-line pb-4">
                  {image ? <ResponsiveImage image={image} sizes="80px" className="size-20 border-2 t-line object-cover" /> : null}
                  <p className="font-extrabold">{product.name}</p>
                </div>
              ) : null}
              {props.show_summary ? <OrderSummary quote={state.quote} loading={state.quoteLoading} estimated={estimated} totalClassName="border-t-2 t-line" /> : null}
              {submit}
            </aside>
          </form>
        </div>
        <MobileBar target={formRef} total={state.quote?.total ?? null} label={props.submit_label || ar.site.orderNow} />
      </section>
    );
  }

  return (
    <section className="t-bg t-stripes border-t-[3px] t-line px-4 py-12 md:py-16">
      <form ref={formRef} onSubmit={onSubmit} onFocus={state.touch} noValidate className="t-hard t-bg mx-auto flex max-w-2xl flex-col gap-5 p-6 sm:p-10">
        {heading}
        {body}
        {props.show_summary ? <OrderSummary quote={state.quote} loading={state.quoteLoading} estimated={estimated} className="border-2 t-line p-4" /> : null}
        {submit}
      </form>
    </section>
  );
}
