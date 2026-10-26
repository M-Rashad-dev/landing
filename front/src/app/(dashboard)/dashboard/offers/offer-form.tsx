"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { DateTimeField } from "@/components/forms/datetime-field";
import { FormField } from "@/components/forms/form-field";
import { ProductMultiSelect } from "@/components/shared/product-multi-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { fromCairoInputValue, toCairoInputValue } from "@/lib/dates";
import { formatPrice } from "@/lib/price";
import { saveOffer, type OfferPayload } from "@/lib/promotions/api";
import type { Offer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.offers;
const moneyRe = /^\d{1,7}(\.\d{1,2})?$/;

const schema = z
  .object({
    name: z.string().trim().min(1, ar.validation.required).max(100, ar.validation.max(100)),
    type: z.enum(["percentage", "fixed", "bundle"]),
    value: z.string().trim(),
    bundle_quantity: z.string().trim(),
    bundle_price: z.string().trim(),
    starts_at: z.string(),
    ends_at: z.string(),
    is_active: z.boolean(),
    badge_text: z.string().trim().max(40, ar.validation.max(40)),
    priority: z.string().trim().regex(/^\d{0,4}$/, ar.validation.number),
    product_ids: z.array(z.number()).min(1, ar.validation.required),
  })
  .superRefine((v, ctx) => {
    if (v.type === "percentage" && !(/^\d+$/.test(v.value) && Number(v.value) >= 1 && Number(v.value) <= 95)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "1 – 95" });
    }
    if (v.type === "fixed" && !(moneyRe.test(v.value) && Number(v.value) > 0)) ctx.addIssue({ code: "custom", path: ["value"], message: ar.validation.number });
    if (v.type === "bundle") {
      if (!(/^\d+$/.test(v.bundle_quantity) && Number(v.bundle_quantity) >= 2 && Number(v.bundle_quantity) <= 20)) {
        ctx.addIssue({ code: "custom", path: ["bundle_quantity"], message: "2 – 20" });
      }
      if (!(moneyRe.test(v.bundle_price) && Number(v.bundle_price) > 0)) ctx.addIssue({ code: "custom", path: ["bundle_price"], message: ar.validation.number });
    }
    if (v.starts_at && v.ends_at && v.ends_at <= v.starts_at) ctx.addIssue({ code: "custom", path: ["ends_at"], message: ar.offers.endsAfterStarts });
  });

type Values = z.infer<typeof schema>;

function toValues(offer: Offer | null): Values {
  return {
    name: offer?.name ?? "",
    type: offer?.type ?? "bundle",
    value: offer?.value !== null && offer?.value !== undefined ? String(offer.value) : "",
    bundle_quantity: offer?.bundle_quantity ? String(offer.bundle_quantity) : "2",
    bundle_price: offer?.bundle_price ? String(offer.bundle_price) : "",
    starts_at: toCairoInputValue(offer?.starts_at),
    ends_at: toCairoInputValue(offer?.ends_at),
    is_active: offer?.is_active ?? true,
    badge_text: offer?.badge_text ?? "",
    priority: String(offer?.priority ?? 0),
    product_ids: offer?.product_ids ?? [],
  };
}

function toPayload(v: Values): OfferPayload {
  return {
    name: v.name.trim(),
    type: v.type,
    value: v.type === "bundle" ? null : v.value,
    bundle_quantity: v.type === "bundle" ? Number(v.bundle_quantity) : null,
    bundle_price: v.type === "bundle" ? v.bundle_price : null,
    starts_at: fromCairoInputValue(v.starts_at),
    ends_at: fromCairoInputValue(v.ends_at),
    is_active: v.is_active,
    badge_text: v.badge_text.trim() || null,
    priority: Number(v.priority || 0),
    product_ids: v.product_ids,
  };
}

export function OfferFormDialog({ offer, open, onClose, onSaved }: { offer: Offer | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="lg">{open ? <OfferForm key={offer?.id ?? "new"} offer={offer} onClose={onClose} onSaved={onSaved} /> : null}</DialogContent>
    </Dialog>
  );
}

function OfferForm({ offer, onClose, onSaved }: { offer: Offer | null; onClose: () => void; onSaved: () => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(offer) });
  const { register, control, handleSubmit, formState, setError } = form;
  const { errors, isSubmitting } = formState;
  const type = useWatch({ control, name: "type" });
  const bundleQty = Number(useWatch({ control, name: "bundle_quantity" }) || 0);
  const bundlePrice = Number(useWatch({ control, name: "bundle_price" }) || 0);

  async function onSubmit(values: Values) {
    try {
      await saveOffer(toPayload(values), offer?.id);
      toast.success(ar.promotions.saved);
      onSaved();
    } catch (error) {
      const unmatched = applyServerErrors(error, setError, Object.keys(values));
      if (!(isApiError(error) && error.isValidation) || unmatched.length) toast.error(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{offer ? t.edit : t.new}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <FormField label={t.fields.name} htmlFor="offer-name" error={errors.name?.message} required>
          <Input id="offer-name" maxLength={100} aria-invalid={!!errors.name} {...register("name")} />
        </FormField>

        <FormField label={t.fields.type}>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t.fields.type}>
                {(["bundle", "percentage", "fixed"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={field.value === option}
                    onClick={() => field.onChange(option)}
                    className={cn("rounded-lg border p-3 text-sm font-semibold transition-colors", field.value === option ? "border-primary bg-secondary text-primary" : "hover:bg-accent")}
                  >
                    {t.types[option]}
                  </button>
                ))}
              </div>
            )}
          />
        </FormField>

        {type === "bundle" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t.fields.bundleQuantity} htmlFor="offer-bq" error={errors.bundle_quantity?.message} required>
              <Input id="offer-bq" type="number" min={2} max={20} dir="ltr" aria-invalid={!!errors.bundle_quantity} {...register("bundle_quantity")} />
            </FormField>
            <FormField label={t.fields.bundlePrice} htmlFor="offer-bp" error={errors.bundle_price?.message} required>
              <Input id="offer-bp" inputMode="decimal" dir="ltr" aria-invalid={!!errors.bundle_price} {...register("bundle_price")} />
            </FormField>
            {bundleQty >= 2 && bundlePrice > 0 ? <p className="text-sm text-muted-foreground sm:col-span-2">{t.effectiveUnit(formatPrice(bundlePrice / bundleQty))}</p> : null}
          </div>
        ) : (
          <FormField label={type === "percentage" ? t.fields.percent : t.fields.fixed} htmlFor="offer-value" error={errors.value?.message} required>
            <Input id="offer-value" inputMode="decimal" dir="ltr" className="sm:max-w-48" aria-invalid={!!errors.value} {...register("value")} />
          </FormField>
        )}

        <FormField label={ar.promotions.products} htmlFor="offer-products" error={errors.product_ids?.message} required>
          <Controller
            control={control}
            name="product_ids"
            render={({ field }) => <ProductMultiSelect id="offer-products" value={field.value} onChange={field.onChange} known={offer?.products ?? []} invalid={!!errors.product_ids} />}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.fields.startsAt} htmlFor="offer-start" error={errors.starts_at?.message}>
            <Controller control={control} name="starts_at" render={({ field }) => <DateTimeField id="offer-start" value={field.value} onChange={field.onChange} emptyLabel={ar.promotions.noStart} />} />
          </FormField>
          <FormField label={t.fields.endsAt} htmlFor="offer-end" error={errors.ends_at?.message}>
            <Controller control={control} name="ends_at" render={({ field }) => <DateTimeField id="offer-end" value={field.value} onChange={field.onChange} invalid={!!errors.ends_at} emptyLabel={ar.promotions.noEnd} />} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.fields.badge} htmlFor="offer-badge" error={errors.badge_text?.message} optional>
            <Input id="offer-badge" maxLength={40} placeholder={t.fields.badgePlaceholder} {...register("badge_text")} />
          </FormField>
          <FormField label={t.fields.priority} htmlFor="offer-priority" error={errors.priority?.message} hint={t.fields.priorityHint}>
            <Input id="offer-priority" type="number" min={0} max={1000} dir="ltr" {...register("priority")} />
          </FormField>
        </div>

        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <label className="flex items-center justify-between rounded-lg border p-3 text-sm font-semibold">
              {t.fields.active}
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {ar.common.cancel}
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {ar.common.save}
        </Button>
      </DialogFooter>
    </form>
  );
}
