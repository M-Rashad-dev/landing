"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload } from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { SortableList } from "@/components/data/sortable-list";
import { DatePicker } from "@/components/forms/date-pickers";
import { FormLayout, FormSection, SaveBar, useUnsavedWarning } from "@/components/forms/form-layout";
import { FileDrop, MoneyInput } from "@/components/forms/inputs";
import { TagInput } from "@/components/forms/tag-input";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { MultiSelect, Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { isoToCairoInput } from "@/lib/format";
import { ar } from "@/messages/ar";
import { useAdminPlans } from "./api";
import { createThemeTag, deleteThemeImage, reorderThemeImages, saveTheme, uploadThemeImage, useAdminTheme, type AdminThemeRow, type ThemeImage, type ThemeTag } from "./catalog-api";

const t = ar.admin.themes.editor;

const schema = z
  .object({
    name: z.string().trim().min(1, t.nameRequired).max(100),
    kind: z.enum(["store", "landing"]),
    short_description: z.string().max(200),
    description: z.string().max(3000),
    features: z.array(z.string().max(120)).max(12),
    price: z.string().refine((v) => v.trim() !== "" && !Number.isNaN(Number(v)), t.priceRequired),
    discount_percent: z.number({ error: t.discountInvalid }).int(t.discountInvalid).min(0, t.discountInvalid).max(90, t.discountInvalid),
    discount_starts_at: z.string(),
    discount_ends_at: z.string(),
    min_plan_key: z.string(),
    is_featured: z.boolean(),
    is_listed: z.boolean(),
    version: z.string().max(20),
    released_at: z.string(),
    tag_ids: z.array(z.string()),
  });
type Values = z.infer<typeof schema>;

const toValues = (th: AdminThemeRow): Values => ({
  name: th.name,
  kind: th.kind,
  short_description: th.short_description ?? "",
  description: th.description ?? "",
  features: th.features ?? [],
  price: String(th.raw.price),
  discount_percent: th.raw.discount_percent,
  discount_starts_at: isoToCairoInput(th.raw.discount_starts_at),
  discount_ends_at: isoToCairoInput(th.raw.discount_ends_at),
  min_plan_key: th.raw.min_plan_key ?? "",
  is_featured: th.raw.is_featured,
  is_listed: th.is_listed,
  version: th.version ?? "",
  released_at: isoToCairoInput(th.released_at),
  tag_ids: th.raw.tag_ids.map(String),
});

export function ThemeEditorPage({ themeKey }: { themeKey: string }) {
  const query = useAdminTheme(themeKey);
  if (query.isPending) return <Skeleton className="h-[32rem] rounded-xl" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  return <ThemeEditor key={themeKey} theme={query.data.data} tags={query.data.meta.tags} />;
}

function ThemeEditor({ theme, tags }: { theme: AdminThemeRow; tags: ThemeTag[] }) {
  const client = useQueryClient();
  const plans = useAdminPlans();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(theme) });
  const { errors, isSubmitting, isDirty } = form.formState;
  const [newTag, setNewTag] = React.useState("");
  const [allTags, setAllTags] = React.useState(tags);
  useUnsavedWarning(isDirty && !isSubmitting);

  const refresh = () => client.invalidateQueries({ queryKey: ["admin", "themes"] });

  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await saveTheme(theme.key, {
        name: v.name.trim(),
        kind: v.kind,
        short_description: v.short_description.trim() || null,
        description: v.description.trim() || null,
        features: v.features,
        price: Number(v.price),
        discount_percent: v.discount_percent,
        discount_starts_at: v.discount_starts_at || null,
        discount_ends_at: v.discount_ends_at || null,
        min_plan_key: v.min_plan_key || null,
        is_featured: v.is_featured,
        is_listed: v.is_listed,
        version: v.version.trim() || null,
        released_at: v.released_at || null,
        tag_ids: v.tag_ids.map(Number),
      });
      form.reset(toValues(saved));
      toast.success(t.saved);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  async function addTag() {
    const name = newTag.trim();
    if (name.length < 2) return;
    try {
      const tag = await createThemeTag(name);
      setAllTags((prev) => (prev.some((x) => x.id === tag.id) ? prev : [...prev, tag]));
      const current = form.getValues("tag_ids");
      if (!current.includes(String(tag.id))) form.setValue("tag_ids", [...current, String(tag.id)], { shouldDirty: true });
      setNewTag("");
      toast.success(t.tagAdded);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        crumbs={[{ label: t.back, href: "/admin/themes" }, { label: theme.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {theme.name}
            <Badge tone={theme.is_active ? "success" : "neutral"} dot>
              {theme.is_active ? ar.admin.themes.active : ar.admin.themes.inactive}
            </Badge>
          </span>
        }
        description={`${ar.admin.themes.inUse(theme.in_use)} · ${ar.admin.themes.sales(theme.sales)}`}
      />
      <FormLayout
        aside={
          <>
            <FormSection title={t.visibility}>
              <div className="flex flex-col divide-y divide-border">
                <Controller control={form.control} name="is_listed" render={({ field }) => <SwitchRow title={t.isListed} checked={field.value} onCheckedChange={field.onChange} />} />
                <Controller control={form.control} name="is_featured" render={({ field }) => <SwitchRow title={t.isFeatured} checked={field.value} onCheckedChange={field.onChange} />} />
              </div>
              <div className="mt-3 flex flex-col gap-3">
                <Field label={t.version} htmlFor="theme-version">
                  <Input id="theme-version" dir="ltr" className="max-w-32" {...form.register("version")} />
                </Field>
                <Field label={t.releasedAt}>
                  <Controller control={form.control} name="released_at" render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} withTime />} />
                </Field>
              </div>
            </FormSection>
            <FormSection title={t.tags}>
              <Controller
                control={form.control}
                name="tag_ids"
                render={({ field }) => <MultiSelect aria-label={t.tags} value={field.value} onChange={field.onChange} options={allTags.map((tag) => ({ value: String(tag.id), label: tag.name }))} />}
              />
              <div className="mt-2 flex gap-2">
                <Input
                  aria-label={t.newTag}
                  placeholder={t.newTag}
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addTag();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => void addTag()} disabled={newTag.trim().length < 2}>
                  <Plus />
                  {t.addTag}
                </Button>
              </div>
            </FormSection>
          </>
        }
      >
        <FormSection title={t.details}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.name} htmlFor="theme-name" error={errors.name?.message} required>
              <Input id="theme-name" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
            </Field>
            <Field label={t.kind}>
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Segmented
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "store", label: ar.admin.themes.kinds.store },
                      { value: "landing", label: ar.admin.themes.kinds.landing },
                    ]}
                  />
                )}
              />
            </Field>
            <Field label={t.shortDescription} htmlFor="theme-short" className="sm:col-span-2" optional>
              <Input id="theme-short" {...form.register("short_description")} />
            </Field>
            <Field label={t.description} htmlFor="theme-description" className="sm:col-span-2" optional>
              <Textarea id="theme-description" rows={4} {...form.register("description")} />
            </Field>
            <Field label={t.features} hint={t.featuresHint} className="sm:col-span-2" optional>
              <Controller control={form.control} name="features" render={({ field }) => <TagInput value={field.value} onChange={field.onChange} max={12} maxLength={120} removeLabel={t.removeFeature} />} />
            </Field>
          </div>
        </FormSection>

        <FormSection title={t.pricing}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.price} htmlFor="theme-price" hint={t.priceHint} error={errors.price?.message} required>
              <Controller control={form.control} name="price" render={({ field }) => <MoneyInput id="theme-price" value={field.value} onChange={field.onChange} aria-invalid={Boolean(errors.price)} />} />
            </Field>
            <Field label={t.discountPercent} htmlFor="theme-discount" error={errors.discount_percent?.message}>
              <Input id="theme-discount" type="number" inputMode="numeric" min={0} max={90} dir="ltr" className="tabular" {...form.register("discount_percent", { valueAsNumber: true })} />
            </Field>
            <Field label={t.discountStarts}>
              <Controller control={form.control} name="discount_starts_at" render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} withTime />} />
            </Field>
            <Field label={t.discountEnds}>
              <Controller control={form.control} name="discount_ends_at" render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} withTime />} />
            </Field>
            <Field label={t.minPlan}>
              <Controller
                control={form.control}
                name="min_plan_key"
                render={({ field }) => (
                  <Select
                    aria-label={t.minPlan}
                    value={field.value || "any"}
                    onValueChange={(v) => field.onChange(v === "any" ? "" : v)}
                    options={[{ value: "any", label: t.anyPlan }, ...(plans.data ?? []).map((p) => ({ value: p.key, label: p.name }))]}
                    searchable={false}
                  />
                )}
              />
            </Field>
          </div>
        </FormSection>

        <ImagesSection theme={theme} onChanged={refresh} />
      </FormLayout>
      <SaveBar visible={isDirty} saving={isSubmitting} onSave={() => void submit()} onDiscard={() => form.reset()} />
    </form>
  );
}

/** Images save on their own (upload, delete, order): they are not part of the form above. */
function ImagesSection({ theme, onChanged }: { theme: AdminThemeRow; onChanged: () => Promise<unknown> }) {
  const [images, setImages] = React.useState(theme.images);
  const [file, setFile] = React.useState<File | null>(null);
  const [kind, setKind] = React.useState<ThemeImage["kind"]>("cover");
  const [busy, setBusy] = React.useState(false);
  const [removing, setRemoving] = React.useState<number | null>(null);

  async function run(action: () => Promise<AdminThemeRow>, done: string) {
    try {
      const saved = await action();
      setImages(saved.images);
      toast.success(done);
      await onChanged();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    if (await run(() => uploadThemeImage(theme.key, file, kind), t.uploaded)) setFile(null);
    setBusy(false);
  }

  async function remove(id: number) {
    setRemoving(id);
    await run(() => deleteThemeImage(theme.key, id), t.imageRemoved);
    setRemoving(null);
  }

  async function reorder(next: ThemeImage[]) {
    const before = images;
    setImages(next);
    try {
      await reorderThemeImages(theme.key, next.map((i) => i.id));
      await onChanged();
    } catch (error) {
      setImages(before);
      toast.error(errorMessage(error));
    }
  }

  return (
    <FormSection title={t.images} description={t.imagesHint}>
      <div className="flex flex-col gap-4">
        {images.length === 0 ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] text-ink-3">{t.noImages}</p>
        ) : (
          <SortableList
            items={images}
            getId={(i) => String(i.id)}
            onReorder={(next) => void reorder(next)}
            render={(image) => (
              <div className="flex items-center gap-3 py-2 pe-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- platform media, already resized */}
                <img src={image.urls.medium ?? Object.values(image.urls)[0]} alt="" className="h-14 w-24 rounded-md border border-border object-cover" />
                <Badge size="sm" tone={image.kind === "cover" ? "brand-soft" : "neutral"}>
                  {t.imageKinds[image.kind]}
                </Badge>
                <span className="tabular flex-1 text-xs text-ink-3" dir="ltr">
                  {image.width}×{image.height}
                </span>
                <Button type="button" size="icon" variant="ghost" aria-label={t.removeImage} loading={removing === image.id} onClick={() => void remove(image.id)}>
                  <Trash2 />
                </Button>
              </div>
            )}
          />
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <FileDrop accept="image/jpeg,image/png,image/webp" file={file} onFile={setFile} hint={t.uploadHint} />
          <div className="flex flex-col gap-2">
            <Field label={t.uploadKind}>
              <Segmented value={kind} onChange={setKind} options={(["cover", "desktop", "mobile"] as const).map((k) => ({ value: k, label: t.imageKinds[k] }))} />
            </Field>
            <Button type="button" onClick={() => void upload()} disabled={!file} loading={busy}>
              <Upload />
              {t.upload}
            </Button>
          </div>
        </div>
      </div>
    </FormSection>
  );
}
