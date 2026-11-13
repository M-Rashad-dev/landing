"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { notFound, useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FormLayout, FormSection, SaveBar, useUnsavedWarning } from "@/components/forms/form-layout";
import { MarkdownEditor } from "@/components/forms/inputs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SeoFields } from "@/features/catalog/seo/seo-fields";
import { plainText, type SeoValue } from "@/features/catalog/seo/seo-model";
import { applyServerErrors, errorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-context";
import { slugify } from "@/lib/slug";
import { ar } from "@/messages/ar";
import { saveStorePage, storePageKeys, template, TEMPLATE_KEYS, useStorePages, type StorePage, type TemplateKey } from "./api";

const t = ar.storePages;

const schema = z.object({
  title: z.string().trim().min(1, t.form.titleRequired).max(120),
  slug: z.string().trim().max(120),
  body: z.string().max(20000),
  is_published: z.boolean(),
  seo: z.custom<SeoValue>(),
});
type Values = z.infer<typeof schema>;

/** /dashboard/design/pages/new (optionally ?template=about) and /dashboard/design/pages/{id}. */
export function StorePageEditor({ id, templateKey }: { id: number | null; templateKey: string | null }) {
  const query = useStorePages();
  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  if (id === null) {
    const key = (TEMPLATE_KEYS as readonly string[]).includes(templateKey ?? "") ? (templateKey as TemplateKey) : null;
    return <StorePageForm page={null} start={key ? template(key) : null} />;
  }
  const page = query.data.find((p) => p.id === id);
  if (!page) notFound();
  return <StorePageForm key={page.id} page={page} start={null} />;
}

function StorePageForm({ page, start }: { page: StorePage | null; start: { title: string; slug: string; body: string } | null }) {
  const router = useRouter();
  const client = useQueryClient();
  const session = useSession();
  const storeName = session.store_name ?? "";
  const defaults: Values = {
    title: page?.title ?? start?.title ?? "",
    slug: page?.slug ?? start?.slug ?? "",
    body: page?.body ?? start?.body ?? "",
    is_published: page?.is_published ?? true,
    seo: { title: page?.seo?.title ?? "", description: page?.seo?.description ?? "" },
  };
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { isDirty, isSubmitting, errors } = form.formState;
  const [title, slug, body] = useWatch({ control: form.control, name: ["title", "slug", "body"] });
  // A new page is not saved yet: the bar shows from the start.
  const unsaved = isDirty || page === null;
  useUnsavedWarning(unsaved);

  const auto = {
    title: title.trim() ? `${title.trim()} | ${storeName}` : storeName,
    description: plainText(body) || t.seoAuto(title.trim() || t.form.pageTitle, storeName),
    keywords: [],
  };

  const submit = form.handleSubmit(async (values) => {
    const seo: { title?: string; description?: string } = {};
    if (values.seo.title?.trim()) seo.title = values.seo.title.trim();
    if (values.seo.description?.trim()) seo.description = values.seo.description.trim();
    try {
      const saved = await saveStorePage({ title: values.title, slug: values.slug.trim() || null, body: values.body.trim() || null, is_published: values.is_published, seo: Object.keys(seo).length ? seo : null }, page?.id);
      await client.invalidateQueries({ queryKey: storePageKeys.all });
      toast.success(page ? t.form.saved : t.form.created);
      if (page) form.reset({ ...values, slug: saved.slug });
      else router.replace(`/dashboard/design/pages/${saved.id}`);
    } catch (error) {
      if (!applyServerErrors(error, form.setError)) toast.error(errorMessage(error));
    }
  });

  const live = page && page.is_published && session.storeUrl ? `${session.storeUrl}/pages/${encodeURIComponent(page.slug)}` : null;

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={page ? page.title : t.form.newTitle}
        crumbs={[{ label: t.form.back, href: "/dashboard/design/pages" }, { label: page ? page.title : t.form.newTitle }]}
        actions={
          live ? (
            <Button asChild variant="outline">
              <a href={live} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                {t.view}
              </a>
            </Button>
          ) : null
        }
      />
      <FormLayout
        aside={
          <Panel>
            <PanelHeader title={t.form.status} />
            <PanelBody>
              <Controller control={form.control} name="is_published" render={({ field }) => <SwitchRow title={t.form.published} description={t.form.publishedHint} checked={field.value} onCheckedChange={field.onChange} />} />
            </PanelBody>
          </Panel>
        }
      >
        <FormSection title={t.form.content} description={t.form.contentHint} hasError={!!errors.title}>
          <div className="flex flex-col gap-4">
            <Field label={t.form.pageTitle} htmlFor="sp-title" error={errors.title?.message} required>
              <Input id="sp-title" maxLength={120} {...form.register("title")} />
            </Field>
            <Field label={t.form.body} htmlFor="sp-body" error={errors.body?.message}>
              <Controller control={form.control} name="body" render={({ field }) => <MarkdownEditor id="sp-body" rows={18} value={field.value} onChange={field.onChange} />} />
            </Field>
          </div>
        </FormSection>
        <FormSection title={ar.catalog.seo.title} description={ar.catalog.seo.description} collapsible defaultOpen={false} hasError={!!errors.slug}>
          <Controller
            control={form.control}
            name="seo"
            render={({ field }) => (
              <SeoFields
                slug={slug}
                onSlugChange={(v) => form.setValue("slug", v, { shouldDirty: true, shouldValidate: true })}
                slugAuto={slugify(title) || "…"}
                slugPrefix="/pages/"
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
        <SaveBar visible={unsaved} saving={isSubmitting} onSave={() => void submit()} onDiscard={page ? () => form.reset(defaults) : undefined} />
      </FormLayout>
    </form>
  );
}
