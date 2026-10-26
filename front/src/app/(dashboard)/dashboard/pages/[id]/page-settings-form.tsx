"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { siteUrl, useSession } from "@/components/dashboard/session-context";
import { FormField } from "@/components/forms/form-field";
import { FormSection } from "@/components/forms/form-section";
import { MediaField } from "@/components/shared/media-picker/media-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes";
import { useIdentities } from "@/lib/identity/api";
import { pageKeys, updatePage, type PageDetail } from "@/lib/pages/api";
import { useProducts } from "@/lib/products/api";
import { isValidTrackingId, normalizeTrackingId, TRACKING_KEYS, type TrackingKey } from "@/lib/tracking/ids";
import { ar } from "@/messages/ar";

const t = ar.pages.settingsPage;
const trackingField = (key: TrackingKey) => z.string().refine((v) => v.trim() === "" || isValidTrackingId(key, v), ar.identities.tracking.invalid);

const schema = z.object({
  title: z.string().trim().min(1, ar.validation.required).max(120, ar.validation.max(120)),
  slug: z.string().trim().min(2, ar.validation.min(2)).max(60, ar.validation.max(60)),
  identity_id: z.string().min(1, ar.validation.required),
  product_id: z.string(),
  seo_title: z.string().max(70, ar.validation.max(70)),
  seo_description: z.string().max(170, ar.validation.max(170)),
  og_media_id: z.number().nullable(),
  noindex: z.boolean(),
  tracking: z.object({
    meta_pixel_id: trackingField("meta_pixel_id"),
    tiktok_pixel_id: trackingField("tiktok_pixel_id"),
    ga4_id: trackingField("ga4_id"),
    gtm_id: trackingField("gtm_id"),
    snapchat_pixel_id: trackingField("snapchat_pixel_id"),
    google_site_verification: trackingField("google_site_verification"),
    facebook_domain_verification: trackingField("facebook_domain_verification"),
  }),
});

type Values = z.infer<typeof schema>;

function toValues(page: PageDetail): Values {
  return {
    title: page.title,
    slug: page.slug,
    identity_id: String(page.identity_id),
    product_id: page.product_id ? String(page.product_id) : "",
    seo_title: page.seo_override?.title ?? "",
    seo_description: page.seo_override?.description ?? "",
    og_media_id: page.seo_override?.og_media_id ?? null,
    noindex: page.seo_override?.noindex ?? false,
    tracking: Object.fromEntries(TRACKING_KEYS.map((key) => [key, page.tracking_override?.[key] ?? ""])) as Values["tracking"],
  };
}

export function PageSettingsForm({ page }: { page: PageDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const identities = useIdentities();
  const products = useProducts({ per_page: 100 });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(page) });
  const { register, control, handleSubmit, formState, setError, reset } = form;
  const { errors, isSubmitting, isDirty } = formState;
  const watched = useWatch({ control });
  useUnsavedChangesWarning(isDirty && !isSubmitting);

  async function onSubmit(values: Values) {
    try {
      const saved = await updatePage(page.id, {
        title: values.title.trim(),
        slug: values.slug.trim().toLowerCase(),
        identity_id: Number(values.identity_id),
        product_id: values.product_id ? Number(values.product_id) : null,
        seo_override: { title: values.seo_title.trim() || null, description: values.seo_description.trim() || null, og_media_id: values.og_media_id, noindex: values.noindex },
        tracking_override: Object.fromEntries(TRACKING_KEYS.map((key) => [key, values.tracking[key].trim() ? normalizeTrackingId(key, values.tracking[key]) : null])),
      });
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success(t.saved);
      reset(toValues(saved));
      router.refresh();
    } catch (error) {
      // Map nested server keys (seo_override.title → seo_title, tracking_override.x → tracking.x).
      if (isApiError(error) && error.isValidation) {
        for (const [key, messages] of Object.entries(error.errors)) {
          const mapped = key.replace("seo_override.title", "seo_title").replace("seo_override.description", "seo_description").replace("seo_override.og_media_id", "og_media_id").replace("tracking_override.", "tracking.");
          setError(mapped as keyof Values, { type: "server", message: messages[0] });
        }
      } else {
        const unmatched = applyServerErrors(error, setError);
        toast.error(unmatched[0] ?? errorMessage(error));
      }
    }
  }

  const liveUrl = siteUrl(session.primary_host, page.is_home ? "/" : `/${watched.slug ?? page.slug}`);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormSection title={t.basics} hasError={Boolean(errors.title || errors.slug || errors.identity_id || errors.product_id)}>
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          {t.liveUrl}:{" "}
          <span dir="ltr" className="font-semibold">
            {liveUrl}
          </span>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={ar.pages.wizard.name} htmlFor="ps-title" error={errors.title?.message} required>
            <Input id="ps-title" maxLength={120} {...register("title")} />
          </FormField>
          <FormField label={ar.pages.wizard.slug} htmlFor="ps-slug" error={errors.slug?.message} hint={ar.pages.wizard.slugHint} required>
            <Input id="ps-slug" dir="auto" maxLength={60} {...register("slug")} />
          </FormField>
          <FormField label={ar.pages.wizard.identity} htmlFor="ps-identity" error={errors.identity_id?.message} required>
            <Select id="ps-identity" options={(identities.data?.data ?? []).map((i) => ({ value: String(i.id), label: i.name }))} {...register("identity_id")} />
          </FormField>
          <FormField label={ar.pages.wizard.product} htmlFor="ps-product" error={errors.product_id?.message}>
            <Select id="ps-product" placeholder={ar.pages.noProduct} options={(products.data?.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))} {...register("product_id")} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title={t.seo} description={t.seoHint} hasError={Boolean(errors.seo_title || errors.seo_description || errors.og_media_id)}>
        <FormField label={t.seoTitle} htmlFor="ps-seo-title" error={errors.seo_title?.message} hint={ar.identities.chars(watched.seo_title?.length ?? 0, 70)}>
          <Input id="ps-seo-title" maxLength={70} {...register("seo_title")} />
        </FormField>
        <FormField label={t.seoDescription} htmlFor="ps-seo-desc" error={errors.seo_description?.message} hint={ar.identities.chars(watched.seo_description?.length ?? 0, 170)}>
          <Textarea id="ps-seo-desc" rows={3} maxLength={170} {...register("seo_description")} />
        </FormField>
        <div className="rounded-lg border bg-white p-4">
          <p className="mb-1 text-xs text-muted-foreground">{ar.identities.googlePreview}</p>
          <p className="truncate text-lg text-[#1a0dab]">{watched.seo_title || watched.title || "—"}</p>
          <p className="truncate text-xs text-[#006621]" dir="ltr">
            {liveUrl}
          </p>
          <p className="line-clamp-2 text-sm text-[#4d5156]">{watched.seo_description || "—"}</p>
        </div>
        <FormField label={t.ogImage}>
          <Controller control={control} name="og_media_id" render={({ field }) => <MediaField value={field.value} onChange={(id) => field.onChange(id)} />} />
        </FormField>
        <Controller
          control={control}
          name="noindex"
          render={({ field }) => (
            <label className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium">
              {t.noindex}
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
      </FormSection>

      <FormSection title={t.tracking} description={t.trackingHint} defaultOpen={false} hasError={Boolean(errors.tracking)}>
        <div className="grid gap-4 sm:grid-cols-2">
          {TRACKING_KEYS.map((key) => (
            <FormField key={key} label={ar.identities.tracking[key].label} htmlFor={`pt-${key}`} error={errors.tracking?.[key]?.message} hint={ar.identities.tracking[key].example}>
              <Input id={`pt-${key}`} dir="ltr" className="text-start font-mono" {...register(`tracking.${key}`)} />
            </FormField>
          ))}
        </div>
      </FormSection>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          {ar.common.save}
        </Button>
      </div>
    </form>
  );
}
