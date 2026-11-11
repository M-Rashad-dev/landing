"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, ImageOff, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { FormLayout, FormSection, SaveBar, useUnsavedWarning } from "@/components/forms/form-layout";
import { MarkdownEditor, MoneyInput } from "@/components/forms/inputs";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";
import { Panel } from "@/components/ui/panel";
import { JumpBar } from "@/components/ui/tabs";
import { ImageGallery } from "@/features/media/image-fields";
import { applyServerErrors, errorMessage, isApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-context";
import { formatMoney } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { useCategories } from "../categories/api";
import { CategoryChecklist } from "../categories/category-checklist";
import { SeoFields } from "../seo/seo-fields";
import { autoProductSeo } from "../seo/seo-model";
import { saveProduct, useRefreshProducts, type ProductDetail } from "./api";
import { EMPTY, fromDetail, productSchema, toPayload, type ProductValues } from "./form-model";
import { OptionsEditor } from "./options-editor";
import { StockEditor } from "./stock-editor";

const t = ar.catalog.form;
const SECTIONS = ["basics", "images", "pricing", "categories", "options", "stock", "visibility", "seo"] as const;
const FIELDS = ["name", "short_description", "description", "price", "compare_at_price", "sku", "category_ids", "primary_category_id", "options", "stock_mode", "stock", "low_stock_threshold", "is_active", "in_store", "is_featured", "slug", "seo"] as const;

/** New product or full edit: every field in titled sections, a live preview beside them. */
export function ProductForm({ product }: { product: ProductDetail | null }) {
  const router = useRouter();
  const session = useSession();
  const refresh = useRefreshProducts();
  const categories = useCategories();
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<ProductValues>({ resolver: zodResolver(productSchema), defaultValues: product ? fromDetail(product) : EMPTY, mode: "onTouched" });
  const { errors, isDirty, isSubmitting } = form.formState;
  useUnsavedWarning(isDirty && !isSubmitting);

  const values = useWatch({ control: form.control }) as ProductValues;
  const allCategories = categories.data ?? [];
  const chosen = values.category_ids.map((id) => allCategories.find((c) => c.id === id)).filter((c) => c !== undefined);
  const mainFirst = [...chosen].sort((a, b) => Number(b.id === values.primary_category_id) - Number(a.id === values.primary_category_id));
  const storeName = session.store_name ?? session.tenant?.name ?? "";
  const auto = autoProductSeo({ name: values.name || "…", shortDescription: values.short_description, description: values.description, price: Number(values.price) || 0, categories: mainFirst.map((c) => c.name) }, storeName);

  async function onSubmit(v: ProductValues) {
    setFormError(null);
    try {
      const saved = await saveProduct(product?.id ?? null, toPayload(v));
      toast.success(product ? t.saved : t.created);
      await refresh();
      if (product) form.reset(fromDetail(saved));
      else router.replace(`/dashboard/catalog/products/${saved.id}`);
    } catch (error) {
      const unmatched = applyServerErrors(error, form.setError, FIELDS);
      if (unmatched.length || !(isApiError(error) && error.isValidation)) setFormError(unmatched[0] ?? errorMessage(error));
      else toast.error(errorMessage(error));
    }
  }

  const submit = form.handleSubmit(onSubmit, () => toast.error(ar.common.errorTitle));
  const sectionError = {
    basics: !!(errors.name || errors.short_description || errors.description),
    pricing: !!(errors.price || errors.compare_at_price || errors.sku),
    options: !!errors.options,
    stock: !!(errors.stock || errors.low_stock_threshold),
    seo: !!(errors.slug || errors.seo),
  };
  const discount = Number(values.compare_at_price) > Number(values.price) && Number(values.price) > 0 ? Math.round(((Number(values.compare_at_price) - Number(values.price)) * 100) / Number(values.compare_at_price)) : null;

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <PageHeader
          crumbs={[{ label: t.back, href: "/dashboard/catalog/products" }, { label: product ? product.name : t.newTitle }]}
          title={product ? t.editTitle : t.newTitle}
          actions={
            <Button type="submit" loading={isSubmitting}>
              {ar.common.save}
            </Button>
          }
          tabs={<JumpBar label={t.editTitle} items={SECTIONS.map((s) => ({ id: `section-${s}`, label: t.sections[s] }))} />}
        />
        {formError ? <Alert tone="danger" className="mb-4">{formError}</Alert> : null}

        <FormLayout aside={<Preview values={values} discount={discount} categoryName={mainFirst[0]?.name} publicUrl={product?.slug && product.in_store && session.storeUrl ? `${session.storeUrl}/products/${encodeURIComponent(product.slug)}` : null} />}>
          <div id="section-basics" className="scroll-mt-36">
            <FormSection title={t.sections.basics} hasError={sectionError.basics}>
              <Field label={t.name} htmlFor="name" error={errors.name?.message} required>
                <Input id="name" placeholder={t.namePlaceholder} aria-invalid={!!errors.name} {...form.register("name")} />
              </Field>
              <Field label={t.shortDescription} htmlFor="short_description" hint={t.shortDescriptionHint} error={errors.short_description?.message}>
                <Textarea id="short_description" rows={2} maxLength={300} {...form.register("short_description")} />
              </Field>
              <Field label={t.descriptionLabel} htmlFor="description" hint={t.descriptionHint} error={errors.description?.message}>
                <Controller control={form.control} name="description" render={({ field }) => <MarkdownEditor id="description" value={field.value} onChange={field.onChange} />} />
              </Field>
            </FormSection>
          </div>

          <div id="section-images" className="scroll-mt-36">
            <FormSection title={t.sections.images} description={t.imagesHint}>
              <Controller control={form.control} name="media" render={({ field }) => <ImageGallery value={field.value} onChange={field.onChange} />} />
            </FormSection>
          </div>

          <div id="section-pricing" className="scroll-mt-36">
            <FormSection title={t.sections.pricing} hasError={sectionError.pricing}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.price} htmlFor="price" error={errors.price?.message} required>
                  <Controller control={form.control} name="price" render={({ field }) => <MoneyInput id="price" value={field.value} onChange={field.onChange} onBlur={field.onBlur} aria-invalid={!!errors.price} />} />
                </Field>
                <Field label={t.compareAt} htmlFor="compare_at_price" hint={discount ? t.discount(discount) : t.compareAtHint} error={errors.compare_at_price?.message}>
                  <Controller control={form.control} name="compare_at_price" render={({ field }) => <MoneyInput id="compare_at_price" value={field.value} onChange={field.onChange} onBlur={field.onBlur} aria-invalid={!!errors.compare_at_price} />} />
                </Field>
              </div>
              <Field label={t.sku} htmlFor="sku" hint={t.skuHint} error={errors.sku?.message}>
                <Input id="sku" dir="ltr" className="text-start sm:w-60" {...form.register("sku")} />
              </Field>
            </FormSection>
          </div>

          <div id="section-categories" className="scroll-mt-36">
            <FormSection title={t.sections.categories} description={t.categoriesHint}>
              <div className="flex flex-wrap items-center gap-1.5">
                {mainFirst.map((c) => (
                  <Badge key={c.id} tone={c.id === values.primary_category_id ? "brand-soft" : "neutral"}>
                    {c.id === values.primary_category_id ? <Star className="size-3 fill-current" aria-label={ar.catalog.products.card.primary} /> : null}
                    {c.name}
                  </Badge>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      {t.pickCategories}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0">
                    <CategoryChecklist
                      categories={allCategories}
                      value={values.category_ids}
                      primary={values.primary_category_id}
                      onChange={(ids, primary) => {
                        form.setValue("category_ids", ids, { shouldDirty: true });
                        form.setValue("primary_category_id", primary, { shouldDirty: true });
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </FormSection>
          </div>

          <div id="section-options" className="scroll-mt-36">
            <FormSection title={t.sections.options} description={t.options.hint} hasError={sectionError.options}>
              <OptionsEditor />
            </FormSection>
          </div>

          <div id="section-stock" className="scroll-mt-36">
            <FormSection title={t.sections.stock} hasError={sectionError.stock}>
              <StockEditor />
            </FormSection>
          </div>

          <div id="section-visibility" className="scroll-mt-36">
            <FormSection title={t.sections.visibility}>
              {(["is_active", "in_store", "is_featured"] as const).map((name) => {
                const copy = name === "is_active" ? [t.visibility.active, t.visibility.activeHint] : name === "in_store" ? [t.visibility.inStore, t.visibility.inStoreHint] : [t.visibility.featured, t.visibility.featuredHint];
                return <Controller key={name} control={form.control} name={name} render={({ field }) => <SwitchRow title={copy[0]} description={copy[1]} checked={field.value} onCheckedChange={field.onChange} />} />;
              })}
            </FormSection>
          </div>

          <div id="section-seo" className="scroll-mt-36">
            <FormSection title={ar.catalog.seo.title} description={ar.catalog.seo.description} hasError={sectionError.seo}>
              <Controller
                control={form.control}
                name="seo"
                render={({ field }) => (
                  <SeoFields
                    slug={values.slug}
                    onSlugChange={(v) => form.setValue("slug", v, { shouldDirty: true, shouldValidate: true })}
                    slugAuto={product?.slug ?? (slugify(values.name) || "…")}
                    slugPrefix="/products/"
                    slugError={errors.slug?.message}
                    seo={field.value}
                    onSeoChange={field.onChange}
                    auto={auto}
                    storeUrl={session.storeUrl}
                    storeName={storeName}
                    showNoindex
                  />
                )}
              />
            </FormSection>
          </div>

          <SaveBar visible={isDirty} saving={isSubmitting} onSave={() => void submit()} onDiscard={() => form.reset()} />
        </FormLayout>
      </form>
    </FormProvider>
  );
}

/** What the customer sees: main image, name, price, main category, availability. */
function Preview({ values, discount, categoryName, publicUrl }: { values: ProductValues; discount: number | null; categoryName?: string; publicUrl: string | null }) {
  const image = values.media[0]?.urls.medium ?? values.media[0]?.urls.thumb;
  return (
    <Panel className="overflow-hidden">
      <p className="border-b border-border px-4 py-2.5 text-xs font-semibold text-ink-3">{t.preview}</p>
      <div className="aspect-square bg-surface-2">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- media preview
          <img src={image} alt="" className={cn("size-full object-cover", !values.is_active && "opacity-60 grayscale")} />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-2 text-xs text-ink-3">
            <ImageOff className="size-6" aria-hidden />
            {t.noImage}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        {categoryName ? <span className="text-xs text-ink-3">{categoryName}</span> : null}
        <p className="font-display text-base font-semibold leading-snug">{values.name || t.namePlaceholder}</p>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="tabular text-lg font-bold">{formatMoney(Number(values.price) || 0)}</span>
          {discount ? (
            <>
              <span className="tabular text-sm text-ink-3 line-through">{formatMoney(Number(values.compare_at_price))}</span>
              <Badge tone="danger" size="sm">
                -{discount}%
              </Badge>
            </>
          ) : null}
        </div>
        {values.short_description ? <p className="text-[13px] text-ink-2">{values.short_description}</p> : null}
        {publicUrl ? (
          <Button variant="outline" size="sm" className="mt-2" asChild>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              {t.viewInStore}
            </a>
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}
