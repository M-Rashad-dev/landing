"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ColorInput } from "@/components/forms/color-input";
import { FormField } from "@/components/forms/form-field";
import { FormSection } from "@/components/forms/form-section";
import { IdentityPreview } from "@/components/shared/identity-preview";
import { MediaField } from "@/components/shared/media-picker/media-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { contrastRatio, isHexColor, readableOn } from "@/lib/color";
import { FONT_KEYS, FONTS, fontStack, isFontKey } from "@/lib/fonts";
import { formatPhoneLocal, isValidPhone, normalizePhone } from "@/lib/format/phone";
import { identityKeys, saveIdentity, type IdentityPayload } from "@/lib/identity/api";
import { BUTTON_RADII, DEFAULT_COLORS, RADIUS_VALUES } from "@/lib/identity/style";
import { isValidTrackingId, normalizeTrackingId, TRACKING_KEYS, type TrackingKey } from "@/lib/tracking/ids";
import type { ColorKey, Identity } from "@/lib/types";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes";
import { useMediaByIds } from "@/lib/media/hooks";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.identities;
const COLOR_KEYS: ColorKey[] = ["primary", "primary_foreground", "secondary", "accent", "background", "foreground", "muted", "border"];
const SOCIAL_KEYS = ["facebook", "instagram", "tiktok", "youtube", "x", "snapchat"] as const;

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, ar.validation.required);
const optionalText = (max: number) => z.string().max(max, ar.validation.max(max));
const optionalPhone = z.string().refine((v) => v.trim() === "" || isValidPhone(v), ar.validation.phone);
const optionalHttps = z.string().refine((v) => v.trim() === "" || /^https:\/\/[^\s]+$/i.test(v.trim()), ar.validation.https);

const trackingId = (key: TrackingKey) => z.string().refine((v) => v.trim() === "" || isValidTrackingId(key, v), t.tracking.invalid);
const trackingShape = {
  meta_pixel_id: trackingId("meta_pixel_id"),
  tiktok_pixel_id: trackingId("tiktok_pixel_id"),
  ga4_id: trackingId("ga4_id"),
  gtm_id: trackingId("gtm_id"),
  snapchat_pixel_id: trackingId("snapchat_pixel_id"),
  google_site_verification: trackingId("google_site_verification"),
  facebook_domain_verification: trackingId("facebook_domain_verification"),
};

const schema = z.object({
  name: z.string().trim().min(1, ar.validation.required).max(60, ar.validation.max(60)),
  brand_name: z.string().trim().min(1, ar.validation.required).max(60, ar.validation.max(60)),
  logo_media_id: z.number().nullable(),
  favicon_media_id: z.number().nullable(),
  og_image_media_id: z.number().nullable(),
  colors: z.object({
    primary: hex,
    primary_foreground: z.string().refine((v) => v === "" || isHexColor(v), "#RRGGBB"),
    secondary: hex,
    accent: hex,
    background: hex,
    foreground: hex,
    muted: hex,
    border: hex,
  }),
  font_heading: z.enum(FONT_KEYS),
  font_body: z.enum(FONT_KEYS),
  button_radius: z.enum(["none", "sm", "md", "lg", "full"]),
  seo_title: optionalText(70),
  seo_title_suffix: optionalText(40),
  seo_description: optionalText(170),
  contact: z.object({
    phone: optionalPhone,
    whatsapp: optionalPhone,
    email: z.string().refine((v) => v.trim() === "" || z.email().safeParse(v.trim()).success, ar.validation.email),
    address: optionalText(300),
  }),
  socials: z.object({
    facebook: optionalHttps,
    instagram: optionalHttps,
    tiktok: optionalHttps,
    youtube: optionalHttps,
    x: optionalHttps,
    snapchat: optionalHttps,
  }),
  tracking: z.object({ ...trackingShape, conversion_event: z.enum(["Lead", "Purchase"]) }),
});

type Values = z.infer<typeof schema>;

function toValues(identity?: Identity, storeName = ""): Values {
  const colors = identity?.colors ?? DEFAULT_COLORS;
  return {
    name: identity?.name ?? "",
    brand_name: identity?.brand_name ?? storeName,
    logo_media_id: identity?.logo_media_id ?? null,
    favicon_media_id: identity?.favicon_media_id ?? null,
    og_image_media_id: identity?.og_image_media_id ?? null,
    colors: {
      primary: colors.primary,
      // Show "auto" (empty) when the stored value is just the computed readable color.
      primary_foreground: identity && colors.primary_foreground !== readableOn(colors.primary) ? colors.primary_foreground : "",
      secondary: colors.secondary,
      accent: colors.accent,
      background: colors.background,
      foreground: colors.foreground,
      muted: colors.muted,
      border: colors.border,
    },
    font_heading: isFontKey(identity?.font_heading) ? identity.font_heading : "cairo",
    font_body: isFontKey(identity?.font_body) ? identity.font_body : "cairo",
    button_radius: identity?.button_radius ?? "md",
    seo_title: identity?.seo_title ?? "",
    seo_title_suffix: identity?.seo_title_suffix ?? "",
    seo_description: identity?.seo_description ?? "",
    contact: {
      phone: formatPhoneLocal(identity?.contact.phone),
      whatsapp: formatPhoneLocal(identity?.contact.whatsapp),
      email: identity?.contact.email ?? "",
      address: identity?.contact.address ?? "",
    },
    socials: Object.fromEntries(SOCIAL_KEYS.map((key) => [key, identity?.socials[key] ?? ""])) as Values["socials"],
    tracking: {
      ...(Object.fromEntries(TRACKING_KEYS.map((key) => [key, identity?.tracking[key] ?? ""])) as Record<TrackingKey, string>),
      conversion_event: identity?.tracking.conversion_event === "Lead" ? "Lead" : "Purchase",
    },
  };
}

const nullIfEmpty = (value: string) => (value.trim() === "" ? null : value.trim());

function toPayload(values: Values): IdentityPayload {
  return {
    name: values.name.trim(),
    brand_name: values.brand_name.trim(),
    logo_media_id: values.logo_media_id,
    favicon_media_id: values.favicon_media_id,
    og_image_media_id: values.og_image_media_id,
    colors: { ...values.colors, primary_foreground: values.colors.primary_foreground || null } as unknown as IdentityPayload["colors"],
    font_heading: values.font_heading,
    font_body: values.font_body,
    button_radius: values.button_radius,
    seo_title: nullIfEmpty(values.seo_title),
    seo_title_suffix: nullIfEmpty(values.seo_title_suffix),
    seo_description: nullIfEmpty(values.seo_description),
    contact: {
      phone: values.contact.phone.trim() ? normalizePhone(values.contact.phone) : null,
      whatsapp: values.contact.whatsapp.trim() ? normalizePhone(values.contact.whatsapp) : null,
      email: nullIfEmpty(values.contact.email),
      address: nullIfEmpty(values.contact.address),
    },
    socials: Object.fromEntries(SOCIAL_KEYS.map((key) => [key, nullIfEmpty(values.socials[key])])) as IdentityPayload["socials"],
    tracking: {
      ...Object.fromEntries(TRACKING_KEYS.map((key) => [key, values.tracking[key].trim() ? normalizeTrackingId(key, values.tracking[key]) : null])),
      conversion_event: values.tracking.conversion_event,
    },
  };
}

const FIELD_ROOTS = ["name", "brand_name", "logo_media_id", "favicon_media_id", "og_image_media_id", "colors", "font_heading", "font_body", "button_radius", "seo_title", "seo_title_suffix", "seo_description", "contact", "socials", "tracking"];

export function IdentityForm({ identity, storeName }: { identity?: Identity; storeName: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(identity, storeName), mode: "onTouched" });
  const { register, control, formState, handleSubmit, setError, reset } = form;
  const { errors, isSubmitting, isDirty } = formState;
  const watched = useWatch({ control });
  useUnsavedChangesWarning(isDirty && !isSubmitting);

  const colors = watched.colors ?? {};
  const primary = isHexColor(colors.primary) ? colors.primary : DEFAULT_COLORS.primary;
  const buttonText = isHexColor(colors.primary_foreground) ? colors.primary_foreground : readableOn(primary);
  const ratio = contrastRatio(buttonText, primary);

  async function onSubmit(values: Values) {
    try {
      const saved = await saveIdentity(toPayload(values), identity?.id);
      await queryClient.invalidateQueries({ queryKey: identityKeys.all });
      toast.success(identity ? t.saved : t.created);
      reset(toValues(saved, storeName));
      if (!identity) router.replace(`/dashboard/identities/${saved.id}`);
      else router.refresh();
    } catch (error) {
      const unmatched = applyServerErrors(error, setError, FIELD_ROOTS);
      if (!(isApiError(error) && error.isValidation) || unmatched.length) toast.error(unmatched[0] ?? errorMessage(error));
    }
  }

  const sectionError = (prefix: keyof Values | Array<keyof Values>) => (Array.isArray(prefix) ? prefix : [prefix]).some((key) => Boolean(errors[key]));

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <FormSection title={t.sections.brand} hasError={sectionError(["name", "brand_name", "logo_media_id", "favicon_media_id", "og_image_media_id"])}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t.fields.name} htmlFor="name" error={errors.name?.message} hint={t.fields.nameHint} required>
              <Input id="name" maxLength={60} aria-invalid={!!errors.name} {...register("name")} />
            </FormField>
            <FormField label={t.fields.brandName} htmlFor="brand_name" error={errors.brand_name?.message} required>
              <Input id="brand_name" maxLength={60} aria-invalid={!!errors.brand_name} {...register("brand_name")} />
            </FormField>
          </div>
          <FormField label={t.fields.logo} error={errors.logo_media_id?.message}>
            <Controller control={control} name="logo_media_id" render={({ field }) => <MediaField value={field.value} onChange={(id) => field.onChange(id)} />} />
          </FormField>
          <FormField label={t.fields.favicon} hint={t.fields.faviconHint} error={errors.favicon_media_id?.message}>
            <Controller control={control} name="favicon_media_id" render={({ field }) => <MediaField value={field.value} purpose="favicon" onChange={(id) => field.onChange(id)} />} />
          </FormField>
          <FormField label={t.fields.ogImage} hint={t.fields.ogHint} error={errors.og_image_media_id?.message}>
            <Controller control={control} name="og_image_media_id" render={({ field }) => <MediaField value={field.value} onChange={(id) => field.onChange(id)} />} />
          </FormField>
        </FormSection>

        <FormSection title={t.sections.colors} hasError={sectionError("colors")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {COLOR_KEYS.map((key) => (
              <FormField key={key} label={t.colors[key]} htmlFor={`color-${key}`} error={errors.colors?.[key]?.message} optional={key === "primary_foreground"}>
                <Controller
                  control={control}
                  name={`colors.${key}`}
                  render={({ field }) => (
                    <ColorInput
                      id={`color-${key}`}
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? "")}
                      invalid={!!errors.colors?.[key]}
                      allowEmpty={key === "primary_foreground"}
                      placeholder={key === "primary_foreground" ? `${t.colors.autoForeground} (${readableOn(primary)})` : undefined}
                    />
                  )}
                />
              </FormField>
            ))}
          </div>
          {ratio < 4.5 ? (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t.colors.contrastWarning}
            </p>
          ) : (
            <p className="flex items-center gap-2 text-xs text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              {t.colors.contrastOk(ratio.toFixed(1))}
            </p>
          )}
        </FormSection>

        <FormSection title={t.sections.fonts} hasError={sectionError(["font_heading", "font_body", "button_radius"])}>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["font_heading", "font_body"] as const).map((key) => (
              <FormField key={key} label={key === "font_heading" ? t.fields.headingFont : t.fields.bodyFont} htmlFor={key} error={errors[key]?.message}>
                <Controller control={control} name={key} render={({ field }) => <Select id={key} value={field.value} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} options={FONT_KEYS.map((font) => ({ value: font, label: FONTS[font].label }))} />} />
                <p className="rounded-lg bg-muted px-3 py-2 text-sm" style={{ fontFamily: fontStack(watched[key]) }}>
                  {t.fontSample}
                </p>
              </FormField>
            ))}
          </div>
          <FormField label={t.fields.buttonRadius} error={errors.button_radius?.message}>
            <Controller
              control={control}
              name="button_radius"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.fields.buttonRadius}>
                  {BUTTON_RADII.map((radius) => (
                    <button
                      key={radius}
                      type="button"
                      role="radio"
                      aria-checked={field.value === radius}
                      onClick={() => field.onChange(radius)}
                      className={cn(
                        "px-4 py-2 text-sm font-semibold transition-colors",
                        field.value === radius ? "bg-primary text-primary-foreground" : "border border-input bg-card hover:bg-accent",
                      )}
                      style={{ borderRadius: RADIUS_VALUES[radius] }}
                    >
                      {t.radius[radius]}
                    </button>
                  ))}
                </div>
              )}
            />
          </FormField>
        </FormSection>

        <FormSection title={t.sections.seo} defaultOpen={false} hasError={sectionError(["seo_title", "seo_title_suffix", "seo_description"])}>
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <FormField label={t.fields.seoTitle} htmlFor="seo_title" error={errors.seo_title?.message} hint={t.chars(watched.seo_title?.length ?? 0, 70)}>
              <Input id="seo_title" maxLength={70} {...register("seo_title")} />
            </FormField>
            <FormField label={t.fields.seoSuffix} htmlFor="seo_title_suffix" error={errors.seo_title_suffix?.message} hint={t.fields.seoSuffixHint}>
              <Input id="seo_title_suffix" maxLength={40} {...register("seo_title_suffix")} />
            </FormField>
          </div>
          <FormField label={t.fields.seoDescription} htmlFor="seo_description" error={errors.seo_description?.message} hint={t.chars(watched.seo_description?.length ?? 0, 170)}>
            <Textarea id="seo_description" rows={3} maxLength={170} {...register("seo_description")} />
          </FormField>
          <GooglePreview title={`${watched.seo_title || watched.brand_name || ""}${watched.seo_title_suffix ? ` ${watched.seo_title_suffix}` : ""}`} description={watched.seo_description ?? ""} />
        </FormSection>

        <FormSection title={t.sections.contact} defaultOpen={false} hasError={sectionError(["contact", "socials"])}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t.fields.phone} htmlFor="contact-phone" error={errors.contact?.phone?.message}>
              <Input id="contact-phone" type="tel" inputMode="tel" dir="ltr" className="text-start" placeholder="01xxxxxxxxx" {...register("contact.phone")} />
            </FormField>
            <FormField label={t.fields.whatsapp} htmlFor="contact-whatsapp" error={errors.contact?.whatsapp?.message}>
              <Input id="contact-whatsapp" type="tel" inputMode="tel" dir="ltr" className="text-start" placeholder="01xxxxxxxxx" {...register("contact.whatsapp")} />
            </FormField>
            <FormField label={t.fields.email} htmlFor="contact-email" error={errors.contact?.email?.message}>
              <Input id="contact-email" type="email" dir="ltr" className="text-start" {...register("contact.email")} />
            </FormField>
            <FormField label={t.fields.address} htmlFor="contact-address" error={errors.contact?.address?.message}>
              <Input id="contact-address" maxLength={300} {...register("contact.address")} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {SOCIAL_KEYS.map((key) => (
              <FormField key={key} label={t.socials[key]} htmlFor={`social-${key}`} error={errors.socials?.[key]?.message}>
                <Input id={`social-${key}`} type="url" dir="ltr" className="text-start" placeholder="https://" {...register(`socials.${key}`)} />
              </FormField>
            ))}
          </div>
        </FormSection>

        <FormSection title={t.sections.tracking} description={t.tracking.intro} defaultOpen={false} hasError={sectionError("tracking")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {TRACKING_KEYS.map((key) => (
              <FormField key={key} label={t.tracking[key].label} htmlFor={`tracking-${key}`} error={errors.tracking?.[key]?.message} hint={`${t.tracking[key].hint} — ${t.tracking[key].example}`}>
                <Input id={`tracking-${key}`} dir="ltr" className="text-start font-mono" placeholder={t.tracking[key].example} aria-invalid={!!errors.tracking?.[key]} {...register(`tracking.${key}`)} />
              </FormField>
            ))}
          </div>
          <FormField label={t.fields.conversionEvent}>
            <Controller
              control={control}
              name="tracking.conversion_event"
              render={({ field }) => (
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t.fields.conversionEvent}>
                  {(["Purchase", "Lead"] as const).map((event) => (
                    <button
                      key={event}
                      type="button"
                      role="radio"
                      aria-checked={field.value === event}
                      onClick={() => field.onChange(event)}
                      className={cn("rounded-lg border p-3 text-start transition-colors", field.value === event ? "border-primary bg-secondary" : "hover:bg-accent")}
                    >
                      <span className="block text-sm font-bold">{event === "Lead" ? t.tracking.lead : t.tracking.purchase}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{event === "Lead" ? t.tracking.leadHint : t.tracking.purchaseHint}</span>
                    </button>
                  ))}
                </div>
              )}
            />
          </FormField>
        </FormSection>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <p className="text-sm font-semibold text-muted-foreground">{t.preview}</p>
        <IdentityPreviewLive control={control} />
        <Button type="submit" size="lg" loading={isSubmitting} disabled={identity ? !isDirty : false}>
          {ar.common.save}
        </Button>
      </aside>
    </form>
  );
}

function IdentityPreviewLive({ control }: { control: ReturnType<typeof useForm<Values>>["control"] }) {
  const values = useWatch({ control });
  const { items } = useMediaByIds([values.logo_media_id ?? null]);
  return (
    <IdentityPreview
      identity={{ colors: { ...values.colors, primary_foreground: values.colors?.primary_foreground || undefined } as Partial<Record<ColorKey, string>>, font_heading: values.font_heading, font_body: values.font_body, button_radius: values.button_radius }}
      brandName={values.brand_name ?? ""}
      logo={items[0] ?? null}
    />
  );
}

function GooglePreview({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 text-start" dir="rtl">
      <p className="mb-1 text-xs text-muted-foreground">{ar.identities.googlePreview}</p>
      <p className="truncate text-lg text-[#1a0dab]">{title || "—"}</p>
      <p className="line-clamp-2 text-sm text-[#4d5156]">{description || "—"}</p>
    </div>
  );
}
