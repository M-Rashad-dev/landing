"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { starterContent } from "@/components/builder/store";
import { ThemeArt } from "@/components/builder/theme-art";
import { ErrorState } from "@/components/dashboard/error-state";
import { FormField } from "@/components/forms/form-field";
import { IdentityPreview } from "@/components/shared/identity-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useIdentities } from "@/lib/identity/api";
import { createPage, pageKeys, slugify, useThemes } from "@/lib/pages/api";
import { productKeys, saveProduct, useProducts } from "@/lib/products/api";
import { getTheme } from "@/themes/registry";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.pages.wizard;

export function NewPageWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const themes = useThemes();
  const identities = useIdentities();
  const products = useProducts({ per_page: 100 });
  const [step, setStep] = useState<1 | 2>(1);
  const [themeKey, setThemeKey] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [identityId, setIdentityId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [quickProduct, setQuickProduct] = useState(false);

  const identityList = identities.data?.data ?? [];
  const selectedIdentity = identityList.find((i) => String(i.id) === identityId) ?? identityList.find((i) => i.is_default) ?? identityList[0];

  async function create() {
    if (!themeKey) return;
    setCreating(true);
    setErrors({});
    try {
      const page = await createPage({
        title: title.trim(),
        slug: slug.trim(),
        theme_key: themeKey,
        identity_id: selectedIdentity?.id ?? null,
        product_id: productId ? Number(productId) : null,
        content: starterContent(themeKey),
      });
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      router.push(`/dashboard/pages/${page.id}/builder`);
    } catch (error) {
      if (isApiError(error) && error.isValidation) {
        setErrors(Object.fromEntries(Object.entries(error.errors).map(([key, messages]) => [key, messages[0] ?? ""])));
      } else toast.error(errorMessage(error));
      setCreating(false);
    }
  }

  if (step === 1) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">1. {t.step1}</h2>
        {themes.isPending ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        ) : themes.isError ? (
          <ErrorState error={themes.error} onRetry={() => themes.refetch()} />
        ) : themes.data.length === 0 ? (
          <p className="text-muted-foreground">{t.noThemes}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-label={t.step1}>
            {themes.data.map((theme) => {
              const def = getTheme(theme.key);
              const selected = themeKey === theme.key;
              return (
                <button
                  key={theme.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setThemeKey(theme.key);
                    setStep(2);
                  }}
                  className={cn("overflow-hidden rounded-2xl border-2 bg-card text-start transition-all hover:shadow-md", selected ? "border-primary" : "border-transparent shadow-sm")}
                >
                  <div className="aspect-[8/5] border-b bg-muted">
                    <ThemeArt themeKey={theme.key} />
                  </div>
                  <div className="p-4">
                    <p className="flex items-center gap-2 text-lg font-extrabold">
                      {theme.name}
                      {selected ? <Check className="size-5 text-primary" aria-hidden /> : null}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{def.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">2. {t.step2}</h2>
          <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
            {t.step1}: {themeKey ? getTheme(themeKey).name : ""}
          </Button>
        </div>
        <FormField label={t.name} htmlFor="wiz-title" error={errors.title} required>
          <Input
            id="wiz-title"
            maxLength={120}
            placeholder={t.namePlaceholder}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
          />
        </FormField>
        <FormField label={t.slug} htmlFor="wiz-slug" error={errors.slug} hint={t.slugHint} required>
          <Input
            id="wiz-slug"
            dir="auto"
            maxLength={60}
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value.toLowerCase());
            }}
          />
        </FormField>
        <FormField label={t.identity} htmlFor="wiz-identity" error={errors.identity_id}>
          <Select id="wiz-identity" value={selectedIdentity ? String(selectedIdentity.id) : ""} onChange={(event) => setIdentityId(event.target.value)} options={identityList.map((i) => ({ value: String(i.id), label: i.name }))} />
        </FormField>
        <FormField label={t.product} htmlFor="wiz-product" error={errors.product_id}>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select id="wiz-product" value={productId} placeholder={t.chooseProduct} onChange={(event) => setProductId(event.target.value)} options={(products.data?.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))} />
            </div>
            <Button type="button" variant="outline" onClick={() => setQuickProduct(true)}>
              <Plus />
              <span className="hidden sm:inline">{t.newProduct}</span>
            </Button>
          </div>
        </FormField>
        {errors.theme_key ? <p className="text-sm text-destructive">{errors.theme_key}</p> : null}
        <Button size="lg" onClick={create} loading={creating} disabled={!title.trim() || !slug.trim()}>
          {t.create}
        </Button>
      </Card>
      <aside className="flex flex-col gap-2">
        {selectedIdentity ? <IdentityPreview identity={selectedIdentity} brandName={selectedIdentity.brand_name} logo={selectedIdentity.logo} /> : null}
      </aside>

      <QuickProductDialog
        open={quickProduct}
        onClose={() => setQuickProduct(false)}
        onCreated={async (id) => {
          await queryClient.invalidateQueries({ queryKey: productKeys.all });
          setProductId(String(id));
          setQuickProduct(false);
        }}
      />
    </section>
  );
}

function QuickProductDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setErrors({});
    try {
      const product = await saveProduct({ name: name.trim(), price: price.trim(), compare_at_price: null, description: null, sku: null, is_active: true, media_ids: [], options: [] });
      setName("");
      setPrice("");
      onCreated(product.id);
    } catch (error) {
      if (isApiError(error) && error.isValidation) setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, v]) => [k, v[0] ?? ""])));
      else toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{ar.pages.wizard.newProduct}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FormField label={ar.products.fields.name} htmlFor="qp-name" error={errors.name} required>
            <Input id="qp-name" value={name} maxLength={150} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label={`${ar.products.fields.price} (${ar.common.currency})`} htmlFor="qp-price" error={errors.price} required>
            <Input id="qp-price" inputMode="decimal" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {ar.common.cancel}
          </Button>
          <Button onClick={submit} loading={saving} disabled={!name.trim() || !price.trim()}>
            {ar.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
