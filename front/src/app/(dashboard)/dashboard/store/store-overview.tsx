"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, ExternalLink, Paintbrush, PencilRuler, Store as StoreIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useSession, useSiteUrl } from "@/components/dashboard/session-context";
import { ErrorState } from "@/components/dashboard/error-state";
import { FormField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { applyServerErrors, errorMessage } from "@/lib/api/errors";
import { setupStore, storeKeys, updateStore, useStore, type DashboardStore } from "@/lib/store/api";
import { useMyThemes } from "@/lib/themes/api";
import { cn } from "@/lib/utils";
import { starterContent } from "@/components/builder/store";
import { DEFAULT_STORE_THEME } from "@/themes/registry";
import { ar } from "@/messages/ar";

const t = ar.store;

export function StoreOverview() {
  const { data, isPending, isError, error, refetch } = useStore();

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-xl lg:col-span-2" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
      </div>
    );
  }
  if (!data.exists) return <SetupCard />;
  return <StoreDashboard store={data} />;
}

/* ---------- First time ---------- */

function SetupCard() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const created = await setupStore(starterContent(DEFAULT_STORE_THEME));
      queryClient.setQueryData(storeKeys.store, created);
      toast.success(t.created);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto flex max-w-xl flex-col items-center gap-4 p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <StoreIcon className="size-7" aria-hidden />
      </span>
      <h2 className="text-xl font-bold">{t.setupTitle}</h2>
      <p className="text-sm text-muted-foreground">{t.setupText}</p>
      <Button size="lg" onClick={() => void create()} loading={busy}>
        {t.setupButton}
      </Button>
    </Card>
  );
}

/* ---------- Store ---------- */

type Existing = Extract<DashboardStore, { exists: true }>;

function StoreDashboard({ store }: { store: Existing }) {
  const queryClient = useQueryClient();
  const session = useSession();
  const toSite = useSiteUrl();
  const [toggling, setToggling] = useState(false);
  const homePublished = store.home?.status === "published";

  async function toggle(enabled: boolean) {
    setToggling(true);
    try {
      const saved = await updateStore({ is_enabled: enabled });
      queryClient.setQueryData(storeKeys.store, saved);
      toast.success(enabled ? t.status.enabled : t.status.disabledToast);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setToggling(false);
    }
  }

  const steps = [
    { done: store.counts.products > 0, label: t.checklist.products(store.counts.products), href: "/dashboard/products" },
    { done: store.counts.categories > 0, label: t.checklist.categories(store.counts.categories), href: "/dashboard/store/categories" },
    { done: homePublished && !store.home?.has_unpublished_changes, label: homePublished && store.home?.has_unpublished_changes ? t.checklist.homeDraft : t.checklist.home, href: store.home ? `/dashboard/pages/${store.home.id}/builder` : undefined },
    { done: store.is_enabled, label: t.checklist.enabled },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="flex flex-col gap-4 p-5 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">{t.status.title}</h2>
            <p className={cn("mt-1 text-sm", store.live ? "text-success" : "text-muted-foreground")} data-testid="store-status">
              {store.live ? t.status.live : store.is_enabled ? t.status.enabledNotLive : t.status.disabled}
            </p>
          </div>
          {store.live ? (
            <Button variant="outline" size="sm" asChild>
              <a href={toSite(session.primary_host, "/")} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                {t.status.visit}
              </a>
            </Button>
          ) : null}
        </div>
        <label className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <span>
            <span className="block text-sm font-semibold">{t.status.enable}</span>
            <span className="block text-xs text-muted-foreground">{t.status.enableHint}</span>
          </span>
          <Switch checked={store.is_enabled} disabled={toggling} onCheckedChange={(checked) => void toggle(checked)} aria-label={t.status.enable} />
        </label>
        <div>
          <p className="mb-2 text-sm font-semibold">{t.checklist.title}</p>
          <ul className="flex flex-col gap-2">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-2 text-sm">
                {step.done ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden /> : <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                {step.href && !step.done ? (
                  <Link href={step.href} className="text-primary underline-offset-4 hover:underline">
                    {step.label}
                  </Link>
                ) : (
                  <span className={cn(step.done && "text-muted-foreground")}>{step.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-bold">{t.home.title}</h2>
        <p className="text-sm text-muted-foreground">{t.home.text}</p>
        {store.home ? (
          <>
            <Badge variant={homePublished ? "success" : "secondary"} className="self-start">
              {homePublished ? t.home.published : t.home.draft}
            </Badge>
            <Button asChild className="mt-auto">
              <Link href={`/dashboard/pages/${store.home.id}/builder`}>
                <PencilRuler />
                {t.home.edit}
              </Link>
            </Button>
          </>
        ) : null}
      </Card>

      <ThemeCard store={store} />
      <SettingsForm store={store} />
    </div>
  );
}

function ThemeCard({ store }: { store: Existing }) {
  const queryClient = useQueryClient();
  const themes = useMyThemes();
  const [saving, setSaving] = useState(false);
  const storeThemes = (themes.data ?? []).filter((theme) => theme.kind === "store");

  async function change(key: string) {
    if (key === store.theme_key) return;
    setSaving(true);
    try {
      queryClient.setQueryData(storeKeys.store, await updateStore({ theme_key: key }));
      toast.success(t.theme.changed);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="font-bold">{t.theme.title}</h2>
      <p className="text-sm text-muted-foreground">{t.theme.hint}</p>
      {themes.isPending ? (
        <Skeleton className="h-10 rounded-lg" />
      ) : (
        <Select
          aria-label={t.theme.title}
          value={store.theme_key}
          disabled={saving}
          onChange={(event) => void change(event.target.value)}
          options={storeThemes.map((theme) => ({ value: theme.key, label: theme.name, disabled: theme.owned === false, hint: theme.owned === false ? t.theme.notOwned : undefined }))}
        />
      )}
      <Button variant="outline" size="sm" asChild className="self-start">
        <Link href="/dashboard/themes/store?kind=store">
          <Paintbrush />
          {t.theme.browse}
        </Link>
      </Button>
    </Card>
  );
}

const settingsSchema = z.object({
  announcement: z.string().trim().max(200, ar.validation.max(200)),
  products_per_page: z.string().regex(/^\d+$/, ar.validation.number).refine((v) => Number(v) >= 8 && Number(v) <= 60, "8 – 60"),
  show_whatsapp: z.boolean(),
  show_out_of_stock: z.boolean(),
  seo_title: z.string().trim().max(70, ar.validation.max(70)),
  seo_description: z.string().trim().max(170, ar.validation.max(170)),
});
type SettingsValues = z.infer<typeof settingsSchema>;

function SettingsForm({ store }: { store: Existing }) {
  const queryClient = useQueryClient();
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      announcement: store.settings.announcement ?? "",
      products_per_page: String(store.settings.products_per_page),
      show_whatsapp: store.settings.show_whatsapp,
      show_out_of_stock: store.settings.show_out_of_stock,
      seo_title: store.seo?.title ?? "",
      seo_description: store.seo?.description ?? "",
    },
  });
  const { register, control, handleSubmit, formState, setError, reset } = form;
  const { errors, isSubmitting, isDirty } = formState;

  async function onSubmit(v: SettingsValues) {
    try {
      const saved = await updateStore({
        settings: { announcement: v.announcement || null, products_per_page: Number(v.products_per_page), show_whatsapp: v.show_whatsapp, show_out_of_stock: v.show_out_of_stock },
        seo: v.seo_title || v.seo_description ? { title: v.seo_title || null, description: v.seo_description || null } : null,
      });
      queryClient.setQueryData(storeKeys.store, saved);
      reset(v);
      toast.success(t.settings.saved);
    } catch (err) {
      const unmatched = applyServerErrors(err, setError, Object.keys(v));
      toast.error(unmatched[0] ?? errorMessage(err));
    }
  }

  const switchRow = (name: "show_whatsapp" | "show_out_of_stock", label: string, hint: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <span>
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </span>
          <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={label} />
        </label>
      )}
    />
  );

  return (
    <Card className="p-5 lg:col-span-2">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <h2 className="font-bold">{t.settings.title}</h2>
        <FormField label={t.settings.announcement} htmlFor="store-announcement" hint={t.settings.announcementHint} error={errors.announcement?.message}>
          <Input id="store-announcement" maxLength={200} {...register("announcement")} />
        </FormField>
        <FormField label={t.settings.perPage} htmlFor="store-per-page" error={errors.products_per_page?.message}>
          <Input id="store-per-page" inputMode="numeric" dir="ltr" className="text-start sm:max-w-32" {...register("products_per_page")} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          {switchRow("show_whatsapp", t.settings.showWhatsapp, t.settings.showWhatsappHint)}
          {switchRow("show_out_of_stock", t.settings.showOutOfStock, t.settings.showOutOfStockHint)}
        </div>
        <div className="flex flex-col gap-3 border-t pt-4">
          <h3 className="text-sm font-bold">{t.seo.title}</h3>
          <p className="text-xs text-muted-foreground">{t.seo.hint}</p>
          <FormField label={t.seo.metaTitle} htmlFor="store-seo-title" error={errors.seo_title?.message}>
            <Input id="store-seo-title" maxLength={70} {...register("seo_title")} />
          </FormField>
          <FormField label={t.seo.metaDescription} htmlFor="store-seo-description" error={errors.seo_description?.message}>
            <Textarea id="store-seo-description" rows={2} maxLength={170} {...register("seo_description")} />
          </FormField>
        </div>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty} className="self-end">
          {ar.common.save}
        </Button>
      </form>
    </Card>
  );
}
