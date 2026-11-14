"use client";

import { Check, Loader2, PackageX, Search } from "lucide-react";
import * as React from "react";
import { formatDateTime, formatMoney } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import type { TrackedOrder, TrackStage } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { Breadcrumb, Container, FormField, inputClass } from "../parts";

const t = ar.storefront.track;
const STEPS: TrackStage[] = ["received", "confirmed", "shipped", "delivered"];

/** Order tracking: number + phone → where the order is. */
export function TrackView({ initialNumber }: { initialNumber: string }) {
  const [number, setNumber] = React.useState(initialNumber);
  const [phone, setPhone] = React.useState("");
  const [errors, setErrors] = React.useState<{ number?: string; phone?: string }>({});
  const [state, setState] = React.useState<{ kind: "idle" | "loading" } | { kind: "error"; message: string } | { kind: "found"; order: TrackedOrder }>({ kind: "idle" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\d{1,9}$/.test(number.trim().replace(/^#/, ""))) next.number = t.numberError;
    if (!normalizePhone(phone)) next.phone = ar.storefront.checkout.errors.phone;
    setErrors(next);
    if (next.number || next.phone) return;
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/public/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ order_number: Number(number.trim().replace(/^#/, "")), phone }),
      });
      const json = (await response.json().catch(() => ({}))) as { data?: TrackedOrder };
      if (response.ok && json.data) setState({ kind: "found", order: json.data });
      else setState({ kind: "error", message: response.status === 404 || response.status === 422 ? t.notFound : response.status === 429 ? t.tooMany : t.failed });
    } catch {
      setState({ kind: "error", message: ar.storefront.checkout.errors.network });
    }
  };

  return (
    <Container className="flex max-w-2xl flex-col gap-5 py-6 @3xl:py-10">
      <Breadcrumb items={[{ name: t.title }]} />
      <div>
        <h1 className="as-2xl font-extrabold">{t.title}</h1>
        <p className="as-sm as-muted mt-1">{t.hint}</p>
      </div>

      {state.kind === "found" ? (
        <OrderStatus
          order={state.order}
          onAnother={() => {
            setState({ kind: "idle" });
            setNumber("");
          }}
        />
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-2xl border p-4 @3xl:p-5">
          <div className="grid gap-4 @xl:grid-cols-2">
            <FormField id="tr-number" label={t.number} error={errors.number}>
              <input id="tr-number" inputMode="numeric" dir="ltr" value={number} onChange={(e) => setNumber(e.target.value)} className={cn(inputClass, "text-end")} aria-invalid={errors.number ? true : undefined} />
            </FormField>
            <FormField id="tr-phone" label={t.phone} error={errors.phone}>
              <input id="tr-phone" type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className={cn(inputClass, "text-end")} aria-invalid={errors.phone ? true : undefined} />
            </FormField>
          </div>
          {state.kind === "error" ? (
            <p className="as-sm flex items-center gap-2 rounded-lg bg-red-50 p-3 font-semibold text-red-700" role="alert">
              <PackageX className="size-5 shrink-0" aria-hidden />
              {state.message}
            </p>
          ) : null}
          <button type="submit" disabled={state.kind === "loading"} className="as-btn as-base h-11 disabled:opacity-60">
            {state.kind === "loading" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Search className="size-5" aria-hidden />}
            {state.kind === "loading" ? t.searching : t.submit}
          </button>
        </form>
      )}
    </Container>
  );
}

function OrderStatus({ order, onAnother }: { order: TrackedOrder; onAnother: () => void }) {
  const ended = order.stage === "returned" || order.stage === "cancelled";
  const reached = ended ? -1 : STEPS.indexOf(order.stage);
  const when = (stage: TrackStage) => order.history.find((h) => h.stage === stage)?.at ?? null;

  return (
    <div className="flex flex-col gap-5 rounded-2xl border p-4 @3xl:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="as-xl font-extrabold">{t.order(order.order_number)}</p>
        <p className="as-xs as-muted">{t.placedAt(formatDateTime(order.created_at))}</p>
      </div>

      {ended ? (
        <p className="as-base rounded-lg bg-(--as-soft) p-3 text-center font-bold">{t.stages[order.stage]}</p>
      ) : (
        <ol className="grid grid-cols-4 gap-1">
          {STEPS.map((stage, i) => {
            const done = i <= reached;
            const at = when(stage);
            return (
              <li key={stage} className="flex flex-col items-center gap-1.5 text-center" aria-current={i === reached ? "step" : undefined}>
                <span className={cn("flex size-9 items-center justify-center rounded-full border-2", done ? "border-(--as-primary) bg-(--as-primary) text-(--as-on-primary)" : "as-muted")}>
                  {done ? <Check className="size-5" aria-hidden /> : <span className="as-sm font-bold">{i + 1}</span>}
                </span>
                <span className={cn("as-xs font-semibold", !done && "as-muted")}>{t.stages[stage]}</span>
                {done && at ? <span className="as-xs as-muted">{formatDateTime(at)}</span> : null}
              </li>
            );
          })}
        </ol>
      )}

      {order.shipping_company || order.tracking_number ? (
        <dl className="as-sm grid gap-2 rounded-lg bg-(--as-card) p-3 @xl:grid-cols-2">
          {order.shipping_company ? (
            <div>
              <dt className="as-xs as-muted">{t.carrier}</dt>
              <dd className="font-semibold">{order.shipping_company}</dd>
            </div>
          ) : null}
          {order.tracking_number ? (
            <div>
              <dt className="as-xs as-muted">{t.trackingNumber}</dt>
              <dd className="font-semibold" dir="ltr">
                {order.tracking_number}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="as-sm font-bold">{t.items}</p>
        <ul className="flex flex-col divide-y rounded-lg border">
          {order.items.map((item, i) => (
            <li key={i} className="as-sm flex justify-between gap-3 px-3 py-2">
              <span>
                {item.name}
                {item.options.length ? <span className="as-muted"> ({item.options.join("، ")})</span> : null}
              </span>
              <span className="as-muted">× {item.quantity}</span>
            </li>
          ))}
        </ul>
        <p className="as-base flex justify-between font-bold">
          <span>{t.total}</span>
          <span>{formatMoney(order.total)}</span>
        </p>
      </div>

      <button type="button" onClick={onAnother} className="as-sm self-center font-semibold as-primary hover:underline">
        {t.another}
      </button>
    </div>
  );
}
