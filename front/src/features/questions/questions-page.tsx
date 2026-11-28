"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, MessageCircleQuestion, MessageSquareReply, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/data/data-table";
import { EntityCell } from "@/components/data/details";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { EmptyState, ErrorState, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Panel } from "@/components/ui/panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/session-context";
import { formatDateTime, formatPhone } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import { ANSWER_MAX, deleteQuestion, QUESTION_TABS, questionsKey, saveQuestion, setQuestionsEnabled, useQuestions, type QuestionFilters, type QuestionRow, type QuestionStatus, type QuestionTab } from "./api";

const t = ar.questions;

const TONES: Record<QuestionStatus, "attention" | "success" | "neutral"> = { unanswered: "attention", published: "success", hidden: "neutral" };

/**
 * «أسئلة العملاء» (docs/plans/tekno/PLAN.md §3): what visitors asked on the products, the unanswered first. The
 * merchant answers (and publishes) each one, hides or deletes it, and turns questions off for the whole store.
 */
export function QuestionsPage() {
  const client = useQueryClient();
  const can = useCan();
  const canAnswer = can("questions.update");
  const [url, setUrl] = useUrlState(["status", "q", "page"] as const);
  const [search, setSearch] = React.useState(url.q);
  const [answering, setAnswering] = React.useState<QuestionRow | null>(null);
  const [removing, setRemoving] = React.useState<QuestionRow | null>(null);
  const [busy, setBusy] = React.useState<number | "switch" | null>(null);
  const filters: QuestionFilters = {
    tab: (QUESTION_TABS as readonly string[]).includes(url.status) ? (url.status as QuestionTab) : "all",
    q: url.q,
    page: Math.max(1, Number(url.page) || 1),
  };
  const query = useQuestions(filters);

  React.useEffect(() => {
    const id = window.setTimeout(() => search.trim() !== url.q && setUrl({ q: search.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
  }, [search, url.q, setUrl]);

  const refresh = () => client.invalidateQueries({ queryKey: questionsKey });

  const togglePublished = async (q: QuestionRow) => {
    setBusy(q.id);
    try {
      await saveQuestion(q.id, { is_published: !q.is_published });
      toast.success(q.is_published ? t.hiddenToast : t.publishedToast);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(removing.id);
    try {
      await deleteQuestion(removing.id);
      toast.success(t.removedToast);
      setRemoving(null);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const switchEnabled = async (enabled: boolean) => {
    setBusy("switch");
    try {
      await setQuestionsEnabled(enabled);
      toast.success(enabled ? t.enabledOn : t.enabledOff);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<QuestionRow>[] = [
    {
      key: "product",
      header: t.columns.product,
      cell: (q) => (
        <EntityCell
          image={q.product?.image?.thumb ?? null}
          title={q.product ? (q.product.deleted ? <span className="text-ink-3">{q.product.name}</span> : <Link href={`/dashboard/catalog/products/${q.product.id}`} className="hover:underline">{q.product.name}</Link>) : "—"}
          subtitle={q.product?.deleted ? t.deletedProduct : undefined}
        />
      ),
    },
    {
      key: "question",
      header: t.columns.question,
      cell: (q) => (
        <span className="flex max-w-lg flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <Badge tone={TONES[q.status]} size="sm">
              {t.status[q.status]}
            </Badge>
          </span>
          <span className="text-sm font-semibold whitespace-pre-line text-ink">{q.question}</span>
          {q.answer ? <span className="border-s-2 border-line ps-2 text-sm whitespace-pre-line text-ink-2">{q.answer}</span> : null}
        </span>
      ),
    },
    {
      key: "asker",
      header: t.columns.asker,
      hideOnMobile: true,
      cell: (q) => (
        <span className="flex flex-col">
          <span>{q.name}</span>
          {q.phone ? (
            <span dir="ltr" className="text-xs text-ink-3 tabular">
              {formatPhone(q.phone)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "date",
      header: t.columns.date,
      hideOnMobile: true,
      cell: (q) => <span className="text-xs text-ink-3 tabular">{formatDateTime(q.created_at)}</span>,
    },
    {
      key: "action",
      header: "",
      align: "end",
      cell: (q) =>
        canAnswer || can("questions.delete") ? (
          <span className="flex flex-wrap items-center justify-end gap-1.5">
            {canAnswer ? (
              <Button variant={q.status === "unanswered" ? "primary" : "outline"} size="sm" onClick={() => setAnswering(q)}>
                <MessageSquareReply />
                {q.answer ? t.editAnswer : t.answer}
              </Button>
            ) : null}
            {canAnswer && q.answer ? (
              <Button variant="outline" size="sm" onClick={() => void togglePublished(q)} disabled={busy === q.id}>
                {q.is_published ? <EyeOff /> : <Eye />}
                {q.is_published ? t.hide : t.publish}
              </Button>
            ) : null}
            {can("questions.delete") ? (
              <Button variant="ghost" size="icon-sm" className="hover:text-danger" aria-label={`${t.remove}: ${q.question}`} onClick={() => setRemoving(q)}>
                <Trash2 />
              </Button>
            ) : null}
          </span>
        ) : null,
    },
  ];

  const counts = query.data?.meta.counts;
  const filtered = Boolean(filters.q || filters.tab !== "all");

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        tabs={
          <Tabs value={filters.tab} onValueChange={(v) => setUrl({ status: v === "all" ? null : v, page: null })}>
            <TabsList>
              {QUESTION_TABS.map((s) => (
                <TabsTrigger key={s} value={s} count={counts?.[s]}>
                  {t.tabs[s]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />
      {query.data ? (
        <Panel className="p-4">
          <SwitchRow title={t.enabled} description={t.enabledHint} checked={query.data.meta.enabled} onCheckedChange={(v) => void switchEnabled(v)} disabled={!canAnswer || busy === "switch"} />
        </Panel>
      ) : null}
      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder={t.search} />
      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={query.isPending ? undefined : query.data.data}
            rowKey={(q) => q.id}
            loading={query.isPending}
            empty={<EmptyState icon={MessageCircleQuestion} title={filtered ? t.noResults : t.emptyTitle} description={filtered ? ar.orders.noResultsText : t.emptyText} />}
          />
          {query.data && query.data.meta.last_page > 1 ? (
            <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={(page) => setUrl({ page: String(page) })} />
          ) : null}
        </>
      )}
      <AnswerDialog question={answering} onClose={() => setAnswering(null)} onSaved={refresh} />
      <ConfirmDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)} title={t.removeTitle} description={t.removeText} confirmLabel={t.remove} destructive loading={removing !== null && busy === removing.id} onConfirm={() => void remove()} />
    </>
  );
}

const schema = z.object({
  answer: z.string().trim().min(1, t.answerRequired).max(ANSWER_MAX, t.answerTooLong),
  is_published: z.boolean(),
});
type Values = z.infer<typeof schema>;

/** «رد»: the answer as visitors will read it, and whether it goes on the product page (on by default). */
function AnswerDialog({ question, onClose, onSaved }: { question: QuestionRow | null; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), values: { answer: question?.answer ?? "", is_published: question ? question.is_published || question.status === "unanswered" : true } });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    if (!question) return;
    try {
      const saved = await saveQuestion(question.id, v);
      toast.success(saved.is_published ? t.savedPublished : t.savedHidden);
      await onSaved();
      onClose();
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, ["answer", "is_published"]);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) toast.error(unmatched[0] ?? errorMessage(error));
    }
  });

  return (
    <Dialog open={question !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader title={t.answerTitle} description={question ? `${question.product?.name ?? ""}` : undefined} />
        <form onSubmit={submit} noValidate>
          <DialogBody className="flex flex-col gap-4">
            {question ? (
              <blockquote className="rounded-lg bg-surface-2 p-3 text-sm whitespace-pre-line text-ink">
                <span className="mb-1 block text-xs font-semibold text-ink-3">{question.name}</span>
                {question.question}
              </blockquote>
            ) : null}
            <Field label={t.answerLabel} htmlFor="question-answer" error={errors.answer?.message} required>
              <Textarea id="question-answer" rows={5} maxLength={ANSWER_MAX} placeholder={t.answerPlaceholder} dir="auto" {...form.register("answer")} />
            </Field>
            <Controller control={form.control} name="is_published" render={({ field }) => <SwitchRow title={t.publishLabel} description={t.publishHint} checked={field.value} onCheckedChange={field.onChange} />} />
            {errors.is_published?.message ? <p className="text-xs text-danger">{errors.is_published.message}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
