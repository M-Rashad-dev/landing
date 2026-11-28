"use client";

import { CheckCircle2, MessageCircleQuestion, Store } from "lucide-react";
import * as React from "react";
import type { ProductQuestions } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { useQuestionForm } from "@/themes/store/shared/use-question-form";
import { FormField, inputClass } from "../parts";

const t = ar.storefront.questions;

/**
 * «أسئلة العملاء» on a product (docs/plans/tekno/PLAN.md §3), the default block of every store theme: the published
 * answers and «اسأل سؤال». Nothing when the store turned questions off. `titleClass` takes the theme's heading font.
 */
export function ProductQuestionsSection({ slug, questions, titleClass }: { slug: string; questions: ProductQuestions | null | undefined; titleClass?: string }) {
  const [open, setOpen] = React.useState(false);
  if (!questions) return null;

  return (
    <section id="questions" className="flex scroll-mt-24 flex-col gap-4 border-t pt-8" aria-labelledby="questions-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="questions-title" className={cn("as-xl", titleClass ?? "font-extrabold")}>
          {t.title}
          {questions.count > 0 ? <span className="as-sm as-muted ms-2 font-semibold">({t.count(questions.count)})</span> : null}
        </h2>
        {open ? null : (
          <button type="button" onClick={() => setOpen(true)} className="as-sm flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold hover:bg-(--as-soft)">
            <MessageCircleQuestion className="size-4" aria-hidden />
            {t.ask}
          </button>
        )}
      </div>

      {open ? <QuestionForm slug={slug} onClose={() => setOpen(false)} /> : null}

      {questions.items.length === 0 ? (
        open ? null : <p className="as-sm as-muted rounded-xl bg-(--as-card) px-4 py-3">{t.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {questions.items.map((q) => (
            <li key={q.id} className="flex flex-col gap-2 py-4 first:pt-0">
              <p className="as-sm flex items-start gap-2 font-bold">
                <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 as-primary" aria-hidden />
                <span className="whitespace-pre-line" dir="auto">
                  {q.question}
                </span>
              </p>
              <p className="as-xs as-muted ps-6">{t.asked(q.name)}</p>
              <div className="as-sm ms-6 flex flex-col gap-1 rounded-lg bg-(--as-soft) px-3 py-2">
                <span className="as-xs flex items-center gap-1 font-bold as-primary">
                  <Store className="size-3.5" aria-hidden />
                  {t.answer}
                </span>
                <p className="whitespace-pre-line" dir="auto">
                  {q.answer}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** «اسأل سؤال»: name, optional phone, the question; then «وصل سؤالك» until another one. */
function QuestionForm({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { form, submit, sent, error, busy, again } = useQuestionForm(slug);
  const { register, formState } = form;
  const errors = formState.errors;

  if (sent) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-(--as-card) p-4" role="status">
        <CheckCircle2 className="size-5 shrink-0 as-primary" aria-hidden />
        <p className="as-sm flex-1 font-semibold">{t.sent}</p>
        <button type="button" onClick={again} className="as-sm rounded-lg border px-3 py-1.5 font-semibold hover:bg-(--as-soft)">
          {t.askAnother}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="relative flex flex-col gap-3 rounded-xl bg-(--as-card) p-4" aria-label={t.formTitle}>
      <div className="grid gap-3 @3xl:grid-cols-2">
        <FormField id="pq-name" label={t.name} error={errors.name?.message}>
          <input id="pq-name" autoComplete="name" maxLength={60} aria-invalid={errors.name ? true : undefined} className={inputClass} {...register("name")} />
        </FormField>
        <FormField id="pq-phone" label={t.phone} hint={t.phoneHint} error={errors.phone?.message} optional>
          <input id="pq-phone" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" maxLength={30} aria-invalid={errors.phone ? true : undefined} className={cn(inputClass, "text-start")} {...register("phone")} />
        </FormField>
      </div>
      <FormField id="pq-question" label={t.question} error={errors.question?.message}>
        <textarea id="pq-question" rows={3} maxLength={500} placeholder={t.placeholder} dir="auto" aria-invalid={errors.question ? true : undefined} className={cn(inputClass, "h-auto py-2")} {...register("question")} />
      </FormField>
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -start-[9999px] size-px opacity-0" {...register("website")} />
      {error ? (
        <p className="as-xs font-semibold text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="as-btn as-sm h-10 disabled:opacity-60">
          {t.send}
        </button>
        <button type="button" onClick={onClose} className="as-sm h-10 rounded-lg border px-3 font-semibold">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
