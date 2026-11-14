"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { SaveBar } from "@/components/forms/form-layout";
import { MarkdownEditor } from "@/components/forms/inputs";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Panel, PanelBody } from "@/components/ui/panel";
import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { ar } from "@/messages/ar";

const t = ar.admin.pages;

export type AdminPlatformPage = { slug: string; title: string; summary: string | null; is_published: boolean; updated_at: string | null; updated_by: string | null; body?: string };

/** "[اسم الشركة]"-style gaps the owner still has to fill. */
export function countPlaceholders(text: string): number {
  return (text.match(/\[[^\]\n]{2,40}\](?!\()/g) ?? []).length;
}

const KEY = ["admin", "platform-pages"] as const;

/** «صفحات المنصة»: the pages linked from the platform site's footer. */
export function PlatformPagesPage({ siteUrl }: { siteUrl: string }) {
  const query = useQuery({ queryKey: KEY, queryFn: () => api<AdminPlatformPage[]>("/admin/platform-pages") });
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {query.isPending ? (
        <div className="flex max-w-3xl flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : query.data.length === 0 ? (
        <EmptyState icon={FileText} title={t.title} />
      ) : (
        <ul className="flex max-w-3xl flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {query.data.map((page) => (
            <li key={page.slug} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                <FileText className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {page.title}
                  <Badge size="sm" tone={page.is_published ? "success" : "neutral"} dot>
                    {page.is_published ? t.published : t.hidden}
                  </Badge>
                </p>
                <p dir="ltr" className="truncate text-end text-xs text-ink-3">
                  /{page.slug}
                </p>
                {page.updated_at ? <p className="text-xs text-ink-3">{t.updated(formatDateTime(page.updated_at), page.updated_by)}</p> : null}
              </div>
              <div className="flex gap-2">
                {page.is_published ? (
                  <Button asChild size="sm" variant="ghost">
                    <a href={`${siteUrl}/${page.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink />
                      {t.view}
                    </a>
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/pages/${page.slug}`}>
                    <Pencil />
                    {t.edit}
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const schema = z.object({
  title: z.string().trim().min(2, t.titleRequired).max(120),
  summary: z.string().max(300),
  body: z.string().trim().min(20, t.bodyRequired).max(60000),
  is_published: z.boolean(),
});
type Values = z.infer<typeof schema>;
const toValues = (p: AdminPlatformPage): Values => ({ title: p.title, summary: p.summary ?? "", body: p.body ?? "", is_published: p.is_published });

/** One page: title, summary, Markdown text with preview, shown or hidden. */
export function PlatformPageEditor({ slug, siteUrl }: { slug: string; siteUrl: string }) {
  const query = useQuery({ queryKey: [...KEY, slug], queryFn: () => api<AdminPlatformPage>(`/admin/platform-pages/${encodeURIComponent(slug)}`) });
  if (query.isPending) return <Skeleton className="h-[32rem] max-w-4xl rounded-xl" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  return <EditorForm page={query.data} siteUrl={siteUrl} />;
}

function EditorForm({ page, siteUrl }: { page: AdminPlatformPage; siteUrl: string }) {
  const client = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(page) });
  const { errors, isDirty, isSubmitting } = form.formState;
  const body = useWatch({ control: form.control, name: "body" });
  const gaps = countPlaceholders(body);

  React.useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await api<AdminPlatformPage>(`/admin/platform-pages/${encodeURIComponent(page.slug)}`, { method: "PUT", body: { ...v, summary: v.summary.trim() || null } });
      form.reset(toValues(saved));
      client.setQueryData([...KEY, page.slug], saved);
      await client.invalidateQueries({ queryKey: KEY, exact: true });
      toast.success(t.saved);
    } catch (error) {
      if (isApiError(error)) for (const f of ["title", "summary", "body"] as const) if (error.errors[f]?.[0]) form.setError(f, { message: error.errors[f][0] });
      toast.error(errorMessage(error));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="max-w-4xl">
      <PageHeader
        title={page.title}
        crumbs={[{ label: t.back, href: "/admin/pages" }, { label: page.title }]}
        actions={
          page.is_published ? (
            <Button asChild variant="outline">
              <a href={`${siteUrl}/${page.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                {t.view}
              </a>
            </Button>
          ) : null
        }
      />
      <Panel>
        <PanelBody className="flex flex-col gap-5">
          <Field label={t.pageTitle} htmlFor="pp-title" error={errors.title?.message} required>
            <Input id="pp-title" {...form.register("title")} />
          </Field>
          <Field label={t.summary} htmlFor="pp-summary" hint={t.summaryHint} error={errors.summary?.message} optional>
            <Textarea id="pp-summary" rows={2} maxLength={300} {...form.register("summary")} />
          </Field>
          <Field label={t.body} htmlFor="pp-body" hint={t.bodyHint} error={errors.body?.message} required>
            <Controller control={form.control} name="body" render={({ field }) => <MarkdownEditor id="pp-body" value={field.value} onChange={field.onChange} rows={22} />} />
          </Field>
          <p className={gaps > 0 ? "rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink" : "rounded-lg bg-success-soft px-3 py-2 text-sm text-success"}>{gaps > 0 ? t.placeholders(gaps) : t.noPlaceholders}</p>
          <Controller control={form.control} name="is_published" render={({ field }) => <SwitchRow title={t.show} description={t.showHint} checked={field.value} onCheckedChange={field.onChange} />} />
        </PanelBody>
      </Panel>
      <SaveBar visible={isDirty} saving={isSubmitting} onSave={() => void submit()} onDiscard={() => form.reset()} />
    </form>
  );
}
