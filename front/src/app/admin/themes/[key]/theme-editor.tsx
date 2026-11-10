"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, ArrowUp, Eye, Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ErrorState } from "@/components/dashboard/error-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { DateTimeField } from "@/components/forms/datetime-field";
import { FormField } from "@/components/forms/form-field";
import { previewUrl } from "@/components/themes/theme-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import {
  createThemeTag,
  deleteThemeImage,
  reorderThemeImages,
  themeCatalogKeys,
  updateThemeDetails,
  uploadThemeImage,
  useAdminPlans,
  useAdminTheme,
  type AdminThemeRow,
} from "@/lib/admin/api";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { fromCairoInputValue, toCairoInputValue } from "@/lib/dates";
import type { ThemeTag } from "@/lib/themes/api";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const c = ar.admin.themeCatalog;

export function ThemeEditor({ themeKey }: { themeKey: string }) {
  const { data, isPending, isError, error, refetch } = useAdminTheme(themeKey);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) return <Skeleton className="h-[40rem] rounded-xl" />;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/admin/themes">
          <ArrowRight />
          {c.back}
        </Link>
      </Button>
      <PageHeader
        title={c.editTitle(data.theme.name)}
        actions={
          <Button variant="outline" asChild>
            <a href={previewUrl(themeKey)} target="_blank" rel="noopener">
              <Eye />
              {ar.themeStore.preview}
            </a>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <DetailsForm key={data.theme.key} theme={data.theme} tags={data.tags} />
        <ImagesCard theme={data.theme} />
      </div>
    </>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, ar.validation.required).max(100),
  kind: z.enum(["landing", "store"]),
  short_description: z.string().max(200),
  description: z.string().max(3000),
  features: z.string().max(1500),
  price: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/, ar.validation.number),
  discount_percent: z.string().regex(/^(\d|[1-8]\d|90)?$/, ar.validation.number),
  discount_starts_at: z.string(),
  discount_ends_at: z.string(),
  min_plan_key: z.string(),
  is_featured: z.boolean(),
  is_listed: z.boolean(),
  version: z.string().max(20),
  tag_ids: z.array(z.number()),
});

type Values = z.infer<typeof schema>;

function toForm(theme: AdminThemeRow): Values {
  return {
    name: theme.name,
    kind: theme.kind,
    short_description: theme.short_description ?? "",
    description: theme.description ?? "",
    features: (theme.features ?? []).join("\n"),
    price: String(theme.raw.price),
    discount_percent: String(theme.raw.discount_percent),
    discount_starts_at: toCairoInputValue(theme.raw.discount_starts_at),
    discount_ends_at: toCairoInputValue(theme.raw.discount_ends_at),
    min_plan_key: theme.raw.min_plan_key ?? "",
    is_featured: theme.raw.is_featured,
    is_listed: theme.is_listed,
    version: theme.version ?? "",
    tag_ids: theme.raw.tag_ids,
  };
}

function DetailsForm({ theme, tags: initialTags }: { theme: AdminThemeRow; tags: ThemeTag[] }) {
  const queryClient = useQueryClient();
  const plans = useAdminPlans();
  const [tags, setTags] = useState(initialTags);
  const [newTag, setNewTag] = useState("");
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toForm(theme) });
  const { errors, isSubmitting, isDirty } = form.formState;

  async function onSubmit(v: Values) {
    try {
      const saved = await updateThemeDetails(theme.key, {
        name: v.name.trim(),
        kind: v.kind,
        short_description: v.short_description.trim() || null,
        description: v.description.trim() || null,
        features: v.features.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 12),
        price: Number(v.price),
        discount_percent: Number(v.discount_percent || 0),
        discount_starts_at: fromCairoInputValue(v.discount_starts_at),
        discount_ends_at: fromCairoInputValue(v.discount_ends_at),
        min_plan_key: v.min_plan_key || null,
        is_featured: v.is_featured,
        is_listed: v.is_listed,
        version: v.version.trim() || null,
        released_at: null,
        tag_ids: v.tag_ids,
      });
      form.reset(toForm(saved));
      void queryClient.invalidateQueries({ queryKey: themeCatalogKeys.list });
      toast.success(c.saved);
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, Object.keys(schema.shape));
      if (!(isApiError(error) && error.isValidation) || unmatched.length) toast.error(unmatched[0] ?? errorMessage(error));
    }
  }

  async function addTag() {
    if (newTag.trim().length < 2) return;
    try {
      const tag = await createThemeTag(newTag.trim());
      setTags((list) => (list.some((t) => t.id === tag.id) ? list : [...list, tag]));
      form.setValue("tag_ids", Array.from(new Set([...form.getValues("tag_ids"), tag.id])), { shouldDirty: true });
      setNewTag("");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const planOptions = [{ value: "", label: c.anyPlan }, ...(plans.data?.plans ?? []).filter((p) => !p.is_archived).map((p) => ({ value: p.key, label: p.name }))];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{c.detailsTitle}</CardTitle>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label={c.name} htmlFor="t-name" error={errors.name?.message} required>
            <Input id="t-name" {...form.register("name")} />
          </FormField>
          <FormField label={c.kind} htmlFor="t-kind">
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <Select id="t-kind" value={field.value} onChange={(e) => field.onChange(e.target.value)} options={[{ value: "landing", label: ar.themeStore.kinds.landing }, { value: "store", label: ar.themeStore.kinds.store }]} />
              )}
            />
          </FormField>
          <FormField label={c.shortDescription} htmlFor="t-short" error={errors.short_description?.message} className="sm:col-span-2">
            <Input id="t-short" {...form.register("short_description")} />
          </FormField>
          <FormField label={c.description} htmlFor="t-desc" error={errors.description?.message} className="sm:col-span-2">
            <Textarea id="t-desc" rows={4} {...form.register("description")} />
          </FormField>
          <FormField label={c.features} htmlFor="t-features" error={errors.features?.message} className="sm:col-span-2">
            <Textarea id="t-features" rows={4} {...form.register("features")} />
          </FormField>
          <FormField label={c.price} htmlFor="t-price" error={errors.price?.message} required>
            <Input id="t-price" inputMode="decimal" dir="ltr" {...form.register("price")} />
          </FormField>
          <FormField label={c.discount} htmlFor="t-discount" error={errors.discount_percent?.message}>
            <Input id="t-discount" inputMode="numeric" dir="ltr" {...form.register("discount_percent")} />
          </FormField>
          <FormField label={c.discountStarts} htmlFor="t-dstart" error={errors.discount_starts_at?.message}>
            <Controller control={form.control} name="discount_starts_at" render={({ field }) => <DateTimeField id="t-dstart" value={field.value} onChange={field.onChange} emptyLabel={ar.common.optional} />} />
          </FormField>
          <FormField label={c.discountEnds} htmlFor="t-dend" error={errors.discount_ends_at?.message}>
            <Controller control={form.control} name="discount_ends_at" render={({ field }) => <DateTimeField id="t-dend" value={field.value} onChange={field.onChange} emptyLabel={ar.common.optional} />} />
          </FormField>
          <FormField label={c.minPlan} htmlFor="t-minplan">
            <Controller control={form.control} name="min_plan_key" render={({ field }) => <Select id="t-minplan" value={field.value} onChange={(e) => field.onChange(e.target.value)} options={planOptions} />} />
          </FormField>
          <FormField label={c.version} htmlFor="t-version" error={errors.version?.message}>
            <Input id="t-version" dir="ltr" {...form.register("version")} />
          </FormField>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span className="text-sm font-semibold">{c.listed}</span>
            <Controller control={form.control} name="is_listed" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span className="text-sm font-semibold">{c.featured}</span>
            <Controller control={form.control} name="is_featured" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </label>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <p className="text-sm font-semibold">{c.tags}</p>
            <Controller
              control={form.control}
              name="tag_ids"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const on = field.value.includes(tag.id);
                    return (
                      <Button key={tag.id} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => field.onChange(on ? field.value.filter((id) => id !== tag.id) : [...field.value, tag.id])}>
                        #{tag.name}
                      </Button>
                    );
                  })}
                </div>
              )}
            />
            <div className="flex gap-2">
              <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder={c.newTag} aria-label={c.newTag} className="max-w-56" />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus />
                {c.addTag}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {ar.common.save}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function ImagesCard({ theme }: { theme: AdminThemeRow }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("cover");
  const [busy, setBusy] = useState(false);
  const images = theme.images ?? [];

  const store = (saved: AdminThemeRow) => {
    queryClient.setQueryData(themeCatalogKeys.one(theme.key), (old: { theme: AdminThemeRow; tags: ThemeTag[] } | undefined) => (old ? { ...old, theme: saved } : old));
    void queryClient.invalidateQueries({ queryKey: themeCatalogKeys.list });
  };

  async function run(action: () => Promise<AdminThemeRow>, success?: string) {
    setBusy(true);
    try {
      store(await action());
      if (success) toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, by: number) {
    const ids = images.map((i) => i.id);
    const target = index + by;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() => reorderThemeImages(theme.key, ids));
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{c.imagesTitle}</CardTitle>
        <p className="text-xs text-muted-foreground">{c.imagesHint}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Select className="w-32" aria-label={c.imagesTitle} value={kind} onChange={(e) => setKind(e.target.value)} options={Object.entries(c.imageKinds).map(([value, label]) => ({ value, label }))} />
          <Button type="button" onClick={() => input.current?.click()} loading={busy}>
            <Upload />
            {c.upload}
          </Button>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={c.upload}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const form = new FormData();
              form.set("image", file);
              form.set("kind", kind);
              void run(() => uploadThemeImage(theme.key, form), c.uploaded);
            }}
          />
        </div>
        <ul className="flex flex-col gap-2">
          {images.map((image, index) => (
            <li key={image.id} className="flex items-center gap-3 rounded-lg border p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- platform media */}
              <img src={image.urls.medium} alt="" className={cn("h-14 rounded object-cover", image.kind === "mobile" ? "w-8" : "w-20")} />
              <span className="flex-1 text-sm">{c.imageKinds[image.kind]}</span>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={c.moveUp} disabled={busy || index === 0} onClick={() => move(index, -1)}>
                <ArrowUp />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={c.moveDown} disabled={busy || index === images.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={c.deleteImage} disabled={busy} onClick={() => run(() => deleteThemeImage(theme.key, image.id))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
