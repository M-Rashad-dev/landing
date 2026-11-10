"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useSession, useSiteUrl } from "@/components/dashboard/session-context";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { FormField } from "@/components/forms/form-field";
import { Markdown } from "@/components/shared/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { deleteStorePage, saveStorePage, storeKeys, useStorePages, type StorePage } from "@/lib/store/api";
import { ar } from "@/messages/ar";

const t = ar.store.pages;
const TEMPLATES = ["about", "returns", "shipping", "privacy"] as const;

type Draft = { page: StorePage | null; template?: (typeof TEMPLATES)[number] };

export function StorePagesManager() {
  const queryClient = useQueryClient();
  const session = useSession();
  const toSite = useSiteUrl();
  const { data, isPending, isError, error, refetch } = useStorePages();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<StorePage | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: storeKeys.pages });

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) return <Skeleton className="h-64 rounded-xl" />;

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteStorePage(deleting.id);
      await refresh();
      toast.success(t.deleted);
      setDeleting(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const existingTitles = new Set(data.map((p) => p.title));
  const templates = TEMPLATES.filter((key) => !existingTitles.has(t.tpl[key].title));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {templates.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t.templates}:</span>
            {templates.map((key) => (
              <Button key={key} variant="outline" size="sm" onClick={() => setEditing({ page: null, template: key })}>
                {t.tpl[key].title}
              </Button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <Button onClick={() => setEditing({ page: null })}>
          <Plus />
          {t.new}
        </Button>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={FileText} title={t.empty} description={t.emptyText} />
      ) : (
        <Card className="divide-y overflow-hidden p-0">
          {data.map((page) => (
            <div key={page.id} className="flex items-center gap-3 px-4 py-3" data-testid="store-page-row">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="truncate">{page.title}</span>
                  <Badge variant={page.is_published ? "success" : "secondary"}>{page.is_published ? t.published : t.draft}</Badge>
                </p>
                <p className="truncate text-xs text-muted-foreground" dir="auto">
                  /pages/{page.slug}
                </p>
              </div>
              {page.is_published ? (
                <Button variant="ghost" size="icon-sm" asChild>
                  <a href={toSite(session.primary_host, `/pages/${encodeURIComponent(page.slug)}`)} target="_blank" rel="noopener noreferrer" aria-label={t.view}>
                    <ExternalLink />
                  </a>
                </Button>
              ) : null}
              <Button variant="ghost" size="icon-sm" onClick={() => setEditing({ page })} aria-label={t.edit}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setDeleting(page)} aria-label={ar.common.delete}>
                <Trash2 />
              </Button>
            </div>
          ))}
        </Card>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent size="lg">
          {editing ? (
            <PageForm
              key={editing.page?.id ?? `new-${editing.template ?? ""}`}
              draft={editing}
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
  title: z.string().trim().min(1, ar.validation.required).max(120, ar.validation.max(120)),
  slug: z.string().trim().max(120, ar.validation.max(120)).refine((v) => v === "" || slugRe.test(v), ar.validation.slug),
  body: z.string().max(20000, ar.validation.max(20000)),
  is_published: z.boolean(),
  seo_title: z.string().trim().max(70, ar.validation.max(70)),
  seo_description: z.string().trim().max(170, ar.validation.max(170)),
});
type Values = z.infer<typeof schema>;

function PageForm({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => Promise<void> }) {
  const { page, template } = draft;
  const tpl = template ? t.tpl[template] : null;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: page?.title ?? tpl?.title ?? "",
      slug: page?.slug ?? "",
      body: page?.body ?? tpl?.body ?? "",
      is_published: page?.is_published ?? true,
      seo_title: page?.seo?.title ?? "",
      seo_description: page?.seo?.description ?? "",
    },
  });
  const { register, control, handleSubmit, formState, setError } = form;
  const { errors, isSubmitting } = formState;
  const [previewing, setPreviewing] = useState(false);
  const body = useWatch({ control, name: "body" });

  async function onSubmit(v: Values) {
    try {
      await saveStorePage(
        {
          title: v.title,
          slug: v.slug || null,
          body: v.body.trim() || null,
          is_published: v.is_published,
          seo: v.seo_title || v.seo_description ? { title: v.seo_title || null, description: v.seo_description || null } : null,
        },
        page?.id,
      );
      toast.success(page ? t.saved : t.created);
      await onSaved();
    } catch (err) {
      const unmatched = applyServerErrors(err, setError, Object.keys(v));
      if (!(isApiError(err) && err.isValidation) || unmatched.length) toast.error(unmatched[0] ?? errorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{page ? t.edit : t.new}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.titleField} htmlFor="sp-title" error={errors.title?.message} required>
            <Input id="sp-title" maxLength={120} aria-invalid={!!errors.title} {...register("title")} />
          </FormField>
          <FormField label={t.slug} htmlFor="sp-slug" hint={ar.store.categories.slugHint.replace("/categories/", "/pages/")} error={errors.slug?.message}>
            <Input id="sp-slug" dir="auto" maxLength={120} {...register("slug")} />
          </FormField>
        </div>
        <FormField label={t.body} htmlFor="sp-body" hint={t.bodyHint} error={errors.body?.message}>
          <div className="flex gap-1 self-end" role="tablist">
            <Button type="button" size="sm" variant={previewing ? "ghost" : "secondary"} onClick={() => setPreviewing(false)} role="tab" aria-selected={!previewing}>
              {ar.products.write}
            </Button>
            <Button type="button" size="sm" variant={previewing ? "secondary" : "ghost"} onClick={() => setPreviewing(true)} role="tab" aria-selected={previewing}>
              {ar.products.preview}
            </Button>
          </div>
          {previewing ? (
            <Markdown className="min-h-48 rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed [&_h2]:mt-3 [&_h2]:font-bold [&_ul]:list-disc [&_ul]:ps-5">{body || "—"}</Markdown>
          ) : (
            <Textarea id="sp-body" rows={12} maxLength={20000} {...register("body")} />
          )}
        </FormField>
        <Controller
          control={control}
          name="is_published"
          render={({ field }) => (
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm font-semibold">{t.published}</span>
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={t.published} />
            </label>
          )}
        />
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <FormField label={ar.store.categories.seoTitle} htmlFor="sp-seo-title" error={errors.seo_title?.message}>
            <Input id="sp-seo-title" maxLength={70} {...register("seo_title")} />
          </FormField>
          <FormField label={ar.store.categories.seoDescription} htmlFor="sp-seo-description" error={errors.seo_description?.message}>
            <Input id="sp-seo-description" maxLength={170} {...register("seo_description")} />
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
