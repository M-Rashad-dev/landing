"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { ARTICLES_KEY, deleteAiArticle, saveAiArticle, useAiArticles, type AiArticle } from "./ai-api";

const t = ar.admin.ai.knowledge;
const CATEGORIES = Object.keys(t.categories);

const schema = z.object({
  title: z.string().trim().min(1, t.required).max(160, t.tooLong),
  category: z.string().min(1, t.required),
  body: z.string().trim().min(1, t.required).max(20000, t.tooLong),
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;

/** «معلومات المساعد»: the articles the support assistant answers from. */
export function KnowledgePanel() {
  const query = useAiArticles();
  const client = useQueryClient();
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [editing, setEditing] = React.useState<AiArticle | "new" | null>(null);
  const [removing, setRemoving] = React.useState<AiArticle | null>(null);
  const [busy, setBusy] = React.useState(false);

  const shown = (query.data ?? []).filter((a) => (!category || a.category === category) && (!q.trim() || `${a.title} ${a.body}`.includes(q.trim())));

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteAiArticle(removing.id);
      await client.invalidateQueries({ queryKey: ARTICLES_KEY });
      setRemoving(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title={t.title}
        description={t.hint}
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus />
            {t.add}
          </Button>
        }
      />
      <PanelBody className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Input aria-label={t.search} placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <div className="w-48">
            <Select aria-label={t.category} value={category} onValueChange={setCategory} emptyLabel={t.allCategories} options={CATEGORIES.map((c) => ({ value: c, label: t.categories[c] }))} searchable={false} />
          </div>
        </div>
        {query.isPending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
        ) : shown.length === 0 ? (
          <EmptyState icon={BookOpen} title={t.empty} description={query.data.length === 0 ? t.emptyHint : undefined} />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {shown.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.title}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                    <span>{t.categories[a.category] ?? a.category}</span>·<span>{t.pieces(a.pieces)}</span>
                    {a.is_active ? (
                      <Badge size="sm" tone={a.state === "ready" ? "success" : a.state === "failed" ? "danger" : "neutral"} title={a.state === "waiting" ? t.waitingHint : (a.error ?? undefined)}>
                        {t.states[a.state]}
                      </Badge>
                    ) : (
                      <Badge size="sm" tone="neutral">
                        {t.off}
                      </Badge>
                    )}
                  </p>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`${t.edit}: ${a.title}`} onClick={() => setEditing(a)}>
                  <Pencil />
                </Button>
                <Button size="icon-sm" variant="ghost" className="hover:text-danger" aria-label={`${t.remove}: ${a.title}`} onClick={() => setRemoving(a)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
      <ArticleDialog article={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)} title={t.removeTitle} description={removing ? `${removing.title} — ${t.removeText}` : undefined} confirmLabel={t.remove} destructive loading={busy} onConfirm={() => void remove()} />
    </Panel>
  );
}

function ArticleDialog({ article, onClose }: { article: AiArticle | "new" | null; onClose: () => void }) {
  const client = useQueryClient();
  const current = article === "new" || article === null ? null : article;
  const empty: Values = { title: "", category: "start", body: "", is_active: true };
  const form = useForm<Values>({ resolver: zodResolver(schema), values: current ? { title: current.title, category: current.category, body: current.body, is_active: current.is_active } : empty });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    try {
      await saveAiArticle(current?.id ?? null, v);
      await client.invalidateQueries({ queryKey: ARTICLES_KEY });
      toast.success(t.saved);
      onClose();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, ["title", "category", "body", "is_active"]);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) toast.error(unmatched[0] ?? errorMessage(error));
    }
  });

  return (
    <Dialog open={article !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader title={current ? t.edit : t.add} />
        <form onSubmit={submit} noValidate>
          <DialogBody className="flex flex-col gap-4">
            <Field label={t.titleLabel} hint={t.titleHint} htmlFor="kb-title" error={errors.title?.message} required>
              <Input id="kb-title" maxLength={160} {...form.register("title")} />
            </Field>
            <Field label={t.category} error={errors.category?.message}>
              <Controller control={form.control} name="category" render={({ field }) => <Select aria-label={t.category} value={field.value} onValueChange={field.onChange} options={CATEGORIES.map((c) => ({ value: c, label: t.categories[c] }))} searchable={false} />} />
            </Field>
            <Field label={t.body} hint={t.bodyHint} htmlFor="kb-body" error={errors.body?.message} required>
              <Textarea id="kb-body" rows={12} maxLength={20000} {...form.register("body")} />
            </Field>
            <Controller control={form.control} name="is_active" render={({ field }) => <SwitchRow title={t.active} checked={field.value} onCheckedChange={field.onChange} />} />
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
      </DialogContent>
    </Dialog>
  );
}
