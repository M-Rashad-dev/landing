"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Alert, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { AddonInput, Input } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Select } from "@/components/ui/select";
import { useProducts } from "@/features/catalog/products/api";
import { isApiError, errorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session-context";
import { SLUG_PATTERN, slugify } from "@/lib/slug";
import { ar } from "@/messages/ar";
import { createLanding, useRefreshLandings, type LandingTheme } from "./api";

const t = ar.landings.create;

const schema = z.object({
  title: z.string().trim().min(1, t.nameRequired).max(120),
  product_id: z.string().min(1, t.productRequired),
  slug: z.string().trim().min(2, t.slugInvalid).max(60, t.slugInvalid).regex(SLUG_PATTERN, t.slugInvalid),
});
type Values = z.infer<typeof schema>;

/** Name, product and address of a new page on the chosen theme. */
export function CreateLandingDialog({ theme, onClose }: { theme: LandingTheme | null; onClose: () => void }) {
  return (
    <Dialog open={theme !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent size="md">{theme ? <CreateForm key={theme.key} theme={theme} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function CreateForm({ theme, onClose }: { theme: LandingTheme; onClose: () => void }) {
  const router = useRouter();
  const refresh = useRefreshLandings();
  const { storeUrl } = useSession();
  const products = useProducts({ q: "", status: "active", category: null, sort: "latest", page: 1 });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: "", product_id: "", slug: "" } });
  const { errors, isSubmitting } = form.formState;
  // The address follows the name until the merchant writes one.
  const [slugTouched, setSlugTouched] = React.useState(false);
  const list = products.data?.data ?? [];

  const submit = form.handleSubmit(async (v) => {
    try {
      const page = await createLanding({ title: v.title.trim(), slug: v.slug.trim().toLowerCase(), theme_key: theme.key, product_id: Number(v.product_id) });
      toast.success(t.created);
      await refresh();
      onClose();
      // Straight into the Builder to shape the new page.
      router.push(`/dashboard/landings/${page.id}/builder`);
    } catch (error) {
      if (isApiError(error)) {
        for (const field of ["title", "slug", "product_id"] as const) {
          const message = error.errors[field]?.[0];
          if (message) form.setError(field, { message });
        }
      }
      toast.error(errorMessage(error));
    }
  });

  return (
    <>
      <DialogHeader title={t.title} description={t.description(theme.name)} />
      <form onSubmit={submit} noValidate>
        <DialogBody className="flex flex-col gap-4">
          <Field label={t.name} htmlFor="landing-title" hint={t.nameHint} error={errors.title?.message} required>
            <Input
              id="landing-title"
              autoFocus
              aria-invalid={Boolean(errors.title)}
              {...form.register("title", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  if (!slugTouched) form.setValue("slug", slugify(e.target.value));
                },
              })}
            />
          </Field>
          <Field label={t.product} hint={t.productHint} error={errors.product_id?.message} required>
            {products.data && list.length === 0 ? (
              <Alert tone="info" action={<Button size="sm" variant="outline" onClick={() => router.push("/dashboard/catalog/products/new")}>{t.addProduct}</Button>}>
                {t.noProducts}
              </Alert>
            ) : (
              <Controller
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <Select
                    aria-label={t.product}
                    value={field.value}
                    onValueChange={field.onChange}
                    invalid={Boolean(errors.product_id)}
                    searchPlaceholder={t.productSearch}
                    placeholder={t.productPick}
                    options={list.map((p) => ({ value: String(p.id), label: p.name }))}
                  />
                )}
              />
            )}
          </Field>
          <Field label={t.slug} htmlFor="landing-slug" hint={t.slugHint} error={errors.slug?.message} required>
            <AddonInput
              id="landing-slug"
              addon={<span className="block max-w-44 truncate whitespace-nowrap text-xs" title={storeUrl ?? undefined}>{`${(storeUrl ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "")}/`}</span>}
              aria-invalid={Boolean(errors.slug)}
              {...form.register("slug", { onChange: () => setSlugTouched(true) })}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {ar.common.cancel}
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {t.confirm}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
