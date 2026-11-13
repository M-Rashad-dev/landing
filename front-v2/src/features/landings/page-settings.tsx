"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Save } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { AddonInput, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useProducts } from "@/features/catalog/products/api";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { SLUG_PATTERN } from "@/lib/slug";
import { ar } from "@/messages/ar";
import { saveLandingSettings, type PageDetail } from "./builder-api";

const t = ar.landings.builder.page;
const tc = ar.landings.create;

const schema = z.object({
  title: z.string().trim().min(1, tc.nameRequired).max(120),
  slug: z.string().trim().min(2, tc.slugInvalid).max(60, tc.slugInvalid).regex(SLUG_PATTERN, tc.slugInvalid),
  product_id: z.string().min(1, tc.productRequired),
  seo_title: z.string().max(70),
  seo_description: z.string().max(170),
  noindex: z.boolean(),
});
type Values = z.infer<typeof schema>;

const toValues = (p: PageDetail): Values => ({
  title: p.title,
  slug: p.slug,
  product_id: p.product_id ? String(p.product_id) : "",
  seo_title: p.seo_override?.title ?? "",
  seo_description: p.seo_override?.description ?? "",
  noindex: p.seo_override?.noindex === true,
});

/** Name, address and product of the page and its Google / sharing text (pixels are one set for all landing pages, in settings). */
export function PageSettingsForm({ page, host, onSaved }: { page: PageDetail; host: string; onSaved: (page: PageDetail) => void }) {
  const products = useProducts({ q: "", status: "all", category: null, sort: "latest", page: 1 });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(page) });
  const { errors, isSubmitting, isDirty } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await saveLandingSettings(page.id, {
        title: v.title.trim(),
        slug: v.slug.trim().toLowerCase(),
        identity_id: page.identity_id,
        product_id: Number(v.product_id),
        seo_override: { title: v.seo_title.trim() || null, description: v.seo_description.trim() || null, noindex: v.noindex },
      });
      form.reset(toValues(saved));
      toast.success(t.saved);
      onSaved(saved);
    } catch (error) {
      if (isApiError(error)) {
        for (const field of ["title", "slug", "product_id"] as const) {
          const message = error.errors[field]?.[0];
          if (message) form.setError(field, { message });
        }
      }
      toast.error(errorMessage(error));
    }
  });

  const options = (products.data?.data ?? []).map((p) => ({ value: String(p.id), label: p.name }));
  if (page.product_id && !options.some((o) => o.value === String(page.product_id))) options.unshift({ value: String(page.product_id), label: `#${page.product_id}` });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label={t.name} htmlFor="ps-title" error={errors.title?.message} required>
        <Input id="ps-title" {...form.register("title")} />
      </Field>
      <Field label={t.slug} htmlFor="ps-slug" hint={tc.slugHint} error={errors.slug?.message} required>
        <AddonInput id="ps-slug" addon={<span className="block max-w-36 truncate text-xs">{host}/</span>} {...form.register("slug")} />
      </Field>
      <Field label={t.product} error={errors.product_id?.message} required>
        <Controller control={form.control} name="product_id" render={({ field }) => <Select aria-label={t.product} value={field.value} onValueChange={field.onChange} options={options} placeholder={tc.productPick} />} />
      </Field>

      <p className="mt-2 text-sm font-semibold">{t.seo}</p>
      <Field label={t.seoTitle} htmlFor="ps-seo-title" hint={t.seoTitleHint} optional>
        <Input id="ps-seo-title" maxLength={70} {...form.register("seo_title")} />
      </Field>
      <Field label={t.seoDescription} htmlFor="ps-seo-description" optional>
        <Textarea id="ps-seo-description" rows={3} maxLength={170} {...form.register("seo_description")} />
      </Field>
      <Controller control={form.control} name="noindex" render={({ field }) => <SwitchRow title={t.noindex} checked={field.value} onCheckedChange={field.onChange} />} />

      <p className="mt-2 text-sm font-semibold">{t.pixels}</p>
      <p className="-mt-2 text-xs text-ink-3">{t.pixelsHint}</p>
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href="/dashboard/settings/pixels" target="_blank">
          <ExternalLink />
          {t.pixelsOpen}
        </Link>
      </Button>

      <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
        <Save />
        {t.save}
      </Button>
    </form>
  );
}
