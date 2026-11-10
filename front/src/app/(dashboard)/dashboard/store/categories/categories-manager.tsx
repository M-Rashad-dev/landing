"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, EyeOff, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { UsageMeter } from "@/components/billing/plan";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { FormField } from "@/components/forms/form-field";
import { MediaField } from "@/components/shared/media-picker/media-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { deleteCategory, reorderCategories, saveCategory, storeKeys, useCategories, type Category, type CategoryPayload } from "@/lib/store/api";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.store.categories;
const MAX_DEPTH = 5;

export function CategoriesManager() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useCategories();
  const [editing, setEditing] = useState<{ category: Category | null; parentId: number | null } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: storeKeys.categories });

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  async function move(category: Category, direction: -1 | 1) {
    const siblings = (data ?? []).filter((c) => c.parent_id === category.parent_id);
    const index = siblings.findIndex((c) => c.id === category.id);
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return;
    const ids = siblings.map((c) => c.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await reorderCategories(ids);
      await refresh();
      toast.success(t.reordered);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteCategory(deleting.id);
      await refresh();
      toast.success(t.deleted);
      setDeleting(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <UsageMeter limit="store_categories" className="w-full sm:w-64" />
        <Button onClick={() => setEditing({ category: null, parentId: null })}>
          <Plus />
          {t.new}
        </Button>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={FolderTree} title={t.empty} description={t.emptyText} action={<Button onClick={() => setEditing({ category: null, parentId: null })}>{t.new}</Button>} />
      ) : (
        <Card className="divide-y overflow-hidden p-0">
          {data.map((category) => {
            const siblings = data.filter((c) => c.parent_id === category.parent_id);
            const index = siblings.findIndex((c) => c.id === category.id);
            return (
              <div key={category.id} className="flex items-center gap-3 px-3 py-2.5" style={{ paddingInlineStart: `${0.75 + category.depth * 1.5}rem` }} data-testid="category-row">
                {category.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- media thumbnail
                  <img src={category.image.thumb} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">{category.name.slice(0, 1)}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <span className="truncate">{category.name}</span>
                    {!category.is_visible ? (
                      <Badge variant="secondary">
                        <EyeOff className="size-3" aria-hidden />
                        {t.hidden}
                      </Badge>
                    ) : null}
                    {category.locked_by_plan ? <Badge variant="warning">{t.locked}</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" dir="auto">
                    /categories/{category.slug} · {t.products(category.products_count)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button variant="ghost" size="icon-sm" disabled={index <= 0} onClick={() => void move(category, -1)} aria-label={t.moveUp}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-sm" disabled={index >= siblings.length - 1} onClick={() => void move(category, 1)} aria-label={t.moveDown}>
                    <ArrowDown />
                  </Button>
                  {category.depth < MAX_DEPTH - 1 ? (
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditing({ category: null, parentId: category.id })} aria-label={t.sub} title={t.sub}>
                      <Plus />
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing({ category, parentId: category.parent_id })} aria-label={t.edit}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setDeleting(category)} aria-label={ar.common.delete}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent size="lg">
          {editing ? (
            <CategoryForm
              key={editing.category?.id ?? `new-${editing.parentId ?? 0}`}
              category={editing.category}
              parentId={editing.parentId}
              all={data}
              onClose={() => setEditing(null)}
              onSaved={async () => {
                await refresh();
                setEditing(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)} title={t.deleteTitle} description={t.deleteText} confirmLabel={ar.common.delete} destructive loading={busy} onConfirm={remove} />
    </div>
  );
}

const slugRe = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

const schema = z.object({
  name: z.string().trim().min(1, ar.validation.required).max(100, ar.validation.max(100)),
  slug: z.string().trim().max(120, ar.validation.max(120)).refine((v) => v === "" || slugRe.test(v), ar.validation.slug),
  parent_id: z.string(),
  description: z.string().trim().max(2000, ar.validation.max(2000)),
  media_id: z.number().nullable(),
  is_visible: z.boolean(),
  seo_title: z.string().trim().max(70, ar.validation.max(70)),
  seo_description: z.string().trim().max(170, ar.validation.max(170)),
});
type Values = z.infer<typeof schema>;

/** Category ids under (and including) a category: they cannot become its parent. */
function subtree(all: Category[], id: number): Set<number> {
  const ids = new Set([id]);
  for (const c of all) if (c.parent_id !== null && ids.has(c.parent_id)) ids.add(c.id);
  return ids;
}

function CategoryForm({ category, parentId, all, onClose, onSaved }: { category: Category | null; parentId: number | null; all: Category[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      parent_id: parentId ? String(parentId) : "",
      description: category?.description ?? "",
      media_id: category?.media_id ?? null,
      is_visible: category?.is_visible ?? true,
      seo_title: category?.seo?.title ?? "",
      seo_description: category?.seo?.description ?? "",
    },
  });
  const { register, control, handleSubmit, formState, setError } = form;
  const { errors, isSubmitting } = formState;
  const blocked = category ? subtree(all, category.id) : new Set<number>();
  const parents = all.filter((c) => !blocked.has(c.id) && c.depth < MAX_DEPTH - 1);

  async function onSubmit(v: Values) {
    const payload: CategoryPayload = {
      name: v.name,
      slug: v.slug || null,
      parent_id: v.parent_id ? Number(v.parent_id) : null,
      description: v.description || null,
      media_id: v.media_id,
      is_visible: v.is_visible,
      seo: v.seo_title || v.seo_description ? { title: v.seo_title || null, description: v.seo_description || null } : null,
    };
    try {
      await saveCategory(payload, category?.id);
      toast.success(category ? t.saved : t.created);
      await onSaved();
    } catch (err) {
      const unmatched = applyServerErrors(err, setError, Object.keys(v));
      if (!(isApiError(err) && err.isValidation) || unmatched.length) toast.error(unmatched[0] ?? errorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{category ? t.edit : parentId ? t.sub : t.new}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.name} htmlFor="cat-name" error={errors.name?.message} required>
            <Input id="cat-name" maxLength={100} aria-invalid={!!errors.name} {...register("name")} />
          </FormField>
          <FormField label={t.parent} htmlFor="cat-parent" error={errors.parent_id?.message}>
            <Controller
              control={control}
              name="parent_id"
              render={({ field }) => (
                <Select id="cat-parent" value={field.value} onChange={(e) => field.onChange(e.target.value)} placeholder={t.noParent} options={parents.map((c) => ({ value: String(c.id), label: `${"— ".repeat(c.depth)}${c.name}` }))} />
              )}
            />
          </FormField>
        </div>
        <FormField label={t.slug} htmlFor="cat-slug" hint={t.slugHint} error={errors.slug?.message}>
          <Input id="cat-slug" dir="auto" maxLength={120} {...register("slug")} />
        </FormField>
        <FormField label={t.descriptionField} htmlFor="cat-description" error={errors.description?.message}>
          <Textarea id="cat-description" rows={3} maxLength={2000} {...register("description")} />
        </FormField>
        <FormField label={t.image} htmlFor="cat-image">
          <Controller control={control} name="media_id" render={({ field }) => <MediaField id="cat-image" value={field.value} onChange={(id) => field.onChange(id)} />} />
        </FormField>
        <Controller
          control={control}
          name="is_visible"
          render={({ field }) => (
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm font-semibold">{t.visible}</span>
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={t.visible} />
            </label>
          )}
        />
        <div className={cn("grid gap-4 border-t pt-4 sm:grid-cols-2")}>
          <FormField label={t.seoTitle} htmlFor="cat-seo-title" error={errors.seo_title?.message}>
            <Input id="cat-seo-title" maxLength={70} {...register("seo_title")} />
          </FormField>
          <FormField label={t.seoDescription} htmlFor="cat-seo-description" error={errors.seo_description?.message}>
            <Input id="cat-seo-description" maxLength={170} {...register("seo_description")} />
          </FormField>
        </div>
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
