"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FormSection } from "@/components/forms/form-layout";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/overlay";
import { Select } from "@/components/ui/select";
import { ImageField } from "@/features/media/image-fields";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-context";
import { SLUG_PATTERN, slugify } from "@/lib/slug";
import { zRequiredString } from "@/lib/validation";
import { ar } from "@/messages/ar";
import { SeoFields } from "../seo/seo-fields";
import { autoCategorySeo, cleanSeo, type SeoValue } from "../seo/seo-model";
import { createCategory, descendantIds, MAX_DEPTH, pathOf, subtreeHeight, updateCategory, useRefreshCategories, type Category } from "./api";

const t = ar.catalog.categories;

const schema = z.object({
  name: zRequiredString(100),
  parent_id: z.number().nullable(),
  slug: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || SLUG_PATTERN.test(v), ar.catalog.seo.slugInvalid),
  description: z.string().max(2000),
  image: z.object({ id: z.number(), url: z.string() }).nullable(),
  is_visible: z.boolean(),
  seo: z.custom<SeoValue>(),
});

type Values = z.infer<typeof schema>;
const FIELDS = ["name", "parent_id", "slug", "description", "media_id", "is_visible", "seo"] as const;

export type DrawerState = { mode: "create"; parentId: number | null } | { mode: "edit"; category: Category } | null;

/** Create / edit a category in a side drawer (the tree stays behind it). */
export function CategoryDrawer({ state, onClose, categories }: { state: DrawerState; onClose: () => void; categories: Category[] }) {
  return (
    <Drawer open={state !== null} onOpenChange={(o) => !o && onClose()} title={state?.mode === "edit" ? t.form.editTitle : t.form.newTitle} width="lg">
      {state ? <CategoryForm key={state.mode === "edit" ? state.category.id : `new-${state.parentId}`} state={state} onDone={onClose} categories={categories} /> : null}
    </Drawer>
  );
}

function CategoryForm({ state, onDone, categories }: { state: NonNullable<DrawerState>; onDone: () => void; categories: Category[] }) {
  const session = useSession();
  const refresh = useRefreshCategories();
  const editing = state.mode === "edit" ? state.category : null;
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: editing?.name ?? "",
      parent_id: editing ? editing.parent_id : state.mode === "create" ? state.parentId : null,
      slug: editing?.slug ?? "",
      description: editing?.description ?? "",
      image: editing?.image && editing.media_id ? { id: editing.media_id, url: editing.image.thumb } : null,
      is_visible: editing?.is_visible ?? true,
      seo: editing?.seo ?? {},
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [name, description, parentId, slug] = useWatch({ control: form.control, name: ["name", "description", "parent_id", "slug"] });

  // A parent can't be the category itself, one of its children, or so deep the subtree would pass 5 levels.
  const blocked = editing ? new Set(descendantIds(categories, editing.id)) : new Set<number>();
  const height = editing ? subtreeHeight(categories, editing.id) : 0;
  const parentOptions = categories
    .filter((c) => !blocked.has(c.id) && c.depth + 1 + height < MAX_DEPTH)
    .map((c) => ({ value: String(c.id), label: c.name, hint: pathOf(categories, c) || undefined }));

  const parent = categories.find((c) => c.id === parentId);
  const ancestors = parent ? [parent.name, ...pathOf(categories, parent).split(" › ").filter(Boolean).reverse()] : [];
  const storeName = session.store_name ?? session.tenant?.name ?? "";
  const auto = autoCategorySeo({ name: name || "…", description, ancestors }, storeName);

  async function onSubmit(values: Values) {
    setFormError(null);
    const body = {
      name: values.name,
      parent_id: values.parent_id,
      slug: values.slug.trim() || null,
      description: values.description.trim() || null,
      media_id: values.image?.id ?? null,
      is_visible: values.is_visible,
      seo: cleanSeo(values.seo),
    };
    try {
      if (editing) await updateCategory(editing.id, body);
      else await createCategory(body);
      toast.success(editing ? t.saved : t.created);
      await refresh();
      onDone();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, FIELDS);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field label={t.form.name} htmlFor="cat-name" error={errors.name?.message} required>
        <Input id="cat-name" autoFocus placeholder={t.form.namePlaceholder} aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <Field label={t.form.parent} htmlFor="cat-parent" error={errors.parent_id?.message}>
        <Controller
          control={form.control}
          name="parent_id"
          render={({ field }) => <Select id="cat-parent" value={field.value === null ? "" : String(field.value)} onValueChange={(v) => field.onChange(v === "" ? null : Number(v))} options={parentOptions} emptyLabel={t.form.noParent} />}
        />
      </Field>
      <Field label={t.form.image} hint={t.form.imageHint}>
        <Controller control={form.control} name="image" render={({ field }) => <ImageField value={field.value} onChange={(m) => field.onChange(m ? { id: m.id, url: m.urls.thumb } : null)} />} />
      </Field>
      <Field label={t.form.descriptionLabel} htmlFor="cat-description" hint={t.form.descriptionHint} error={errors.description?.message}>
        <Textarea id="cat-description" rows={3} {...form.register("description")} />
      </Field>
      <Controller control={form.control} name="is_visible" render={({ field }) => <SwitchRow title={t.form.visible} description={t.form.visibleHint} checked={field.value} onCheckedChange={field.onChange} />} />

      <FormSection title={ar.catalog.seo.title} description={ar.catalog.seo.description} collapsible defaultOpen={false} hasError={!!errors.slug}>
        <Controller
          control={form.control}
          name="seo"
          render={({ field }) => (
            <SeoFields
              slug={slug}
              onSlugChange={(v) => form.setValue("slug", v, { shouldDirty: true, shouldValidate: true })}
              slugAuto={slugify(name) || "…"}
              slugPrefix="/categories/"
              slugError={errors.slug?.message}
              seo={field.value}
              onSeoChange={field.onChange}
              auto={auto}
              storeUrl={session.storeUrl}
              storeName={storeName}
            />
          )}
        />
      </FormSection>

      <div className="sticky bottom-0 -mx-5 -mb-4 flex gap-2 border-t border-border bg-surface px-5 py-3">
        <Button type="submit" loading={isSubmitting}>
          {ar.common.save}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {ar.common.cancel}
        </Button>
      </div>
    </form>
  );
}
