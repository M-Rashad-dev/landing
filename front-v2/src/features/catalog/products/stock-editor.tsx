"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { RadioCards } from "@/components/ui/choice";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ar } from "@/messages/ar";
import { combinations, stockOptions, type ProductValues } from "./form-model";

const t = ar.catalog.form.stock;
const MAX_COMBINATIONS = 300;

const digits = (v: string) => /^\d{0,7}$/.test(v);

/** Unlimited, one number, or one number per option combination (table built from the options). */
export function StockEditor() {
  const { control, register, formState, setValue } = useFormContext<ProductValues>();
  const [mode, options, stocks] = useWatch({ control, name: ["stock_mode", "options", "variant_stock"] });
  const combos = mode === "variant" ? combinations(options) : [];
  const dims = stockOptions(options);
  const total = combos.reduce((sum, c) => sum + Number(stocks[c.key] || 0), 0);
  const hasOptional = options.some((o) => !o.is_required);

  return (
    <div className="flex flex-col gap-4">
      <Controller
        control={control}
        name="stock_mode"
        render={({ field }) => (
          <RadioCards
            value={field.value}
            onValueChange={field.onChange}
            className="sm:grid-cols-3"
            options={(["unlimited", "product", "variant"] as const).map((m) => ({ value: m, title: t.modes[m].title, description: t.modes[m].description }))}
          />
        )}
      />

      {mode === "product" ? (
        <Field label={t.quantity} htmlFor="stock" error={formState.errors.stock?.message}>
          <Input id="stock" dir="ltr" inputMode="numeric" className="tabular w-40" aria-invalid={!!formState.errors.stock} {...register("stock")} />
        </Field>
      ) : null}

      {mode === "variant" ? (
        dims.length === 0 ? (
          <Alert tone="warning">{t.variantsNeedOptions}</Alert>
        ) : combos.length > MAX_COMBINATIONS ? (
          <Alert tone="danger">{t.tooMany}</Alert>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-ink-3">
                <tr>
                  <th className="px-3 py-2 text-start font-semibold">{t.combination}</th>
                  <th className="w-36 px-3 py-2 text-start font-semibold">{t.quantity}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {combos.map((c) => (
                  <tr key={c.key}>
                    <td className="px-3 py-1.5">{c.labels.join(" / ")}</td>
                    <td className="px-3 py-1.5">
                      <Input
                        dir="ltr"
                        inputMode="numeric"
                        className="tabular h-8"
                        aria-label={`${t.quantity}: ${c.labels.join(" / ")}`}
                        value={stocks[c.key] ?? ""}
                        placeholder="0"
                        onChange={(e) => digits(e.target.value) && setValue("variant_stock", { ...stocks, [c.key]: e.target.value }, { shouldDirty: true })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-2/60 text-xs font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan={2}>
                    {t.total(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      ) : null}
      {mode === "variant" && hasOptional ? <p className="text-xs text-ink-3">{t.optionalNote}</p> : null}

      {mode !== "unlimited" ? (
        <Field label={t.lowAlert} htmlFor="low_stock_threshold" hint={t.lowAlertHint} error={formState.errors.low_stock_threshold?.message}>
          <Input id="low_stock_threshold" dir="ltr" inputMode="numeric" className="tabular w-40" placeholder="5" {...register("low_stock_threshold")} />
        </Field>
      ) : null}
    </div>
  );
}
