"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Building2, CheckCircle2, Copy, CreditCard, ExternalLink, Landmark, Lock, Smartphone, Wallet, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/choice";
import { Alert, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { usePlanFeature, useSession } from "@/lib/auth/session-context";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.settings.store;

export type StoreSettings = { announcement: string | null; products_per_page: number; show_whatsapp: boolean; show_out_of_stock: boolean };
export type StoreState =
  | { exists: false; live: false }
  | {
      exists: true;
      is_enabled: boolean;
      live: boolean;
      theme_key: string;
      home: { id: number; status: "draft" | "published"; published_at: string | null; has_unpublished_changes: boolean } | null;
      settings: StoreSettings;
      counts: { products: number; categories: number };
    };

const PAYMENT_METHODS = [
  { key: "cod", icon: Banknote, active: true },
  { key: "card", icon: CreditCard, active: false },
  { key: "wallet", icon: Smartphone, active: false },
  { key: "instapay", icon: Wallet, active: false },
  { key: "bank", icon: Landmark, active: false },
  { key: "installments", icon: Building2, active: false },
] as const;

export function useStore() {
  return useQuery({ queryKey: ["store"], queryFn: () => api<StoreState>("/dashboard/store") });
}

export function StorePage() {
  const query = useStore();
  const allowed = usePlanFeature("store");

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {query.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_24rem]">
          <div className="flex flex-col gap-4">
            <Status store={query.data} allowed={allowed} />
            <General />
            {query.data.exists ? <Display store={query.data} /> : null}
          </div>
          <Payments />
        </div>
      )}
    </>
  );
}

function Status({ store, allowed }: { store: StoreState; allowed: boolean }) {
  const session = useSession();
  const client = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["store"] });
    await client.invalidateQueries({ queryKey: ["home"] });
    router.refresh();
  };

  async function run(key: string, action: () => Promise<unknown>, message: string) {
    setBusy(key);
    try {
      await action();
      toast.success(message);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const homePublished = store.exists && store.home?.status === "published";
  const enabled = store.exists && store.is_enabled;
  // What still stops the store, in the order to fix it.
  const missing: Array<{ key: keyof typeof t.reasons; action?: React.ReactNode }> = [];
  if (!allowed)
    missing.push({
      key: "plan",
      action: (
        <Button asChild size="sm">
          <Link href="/dashboard/settings/billing">{t.upgrade}</Link>
        </Button>
      ),
    });
  else if (!store.exists)
    missing.push({
      key: "setup",
      action: (
        <Button size="sm" loading={busy === "setup"} onClick={() => void run("setup", () => api("/dashboard/store/setup", { method: "POST", body: {} }), t.prepared)}>
          {t.prepare}
        </Button>
      ),
    });
  else {
    if (!homePublished && store.home)
      missing.push({
        key: "home",
        action: (
          <Button size="sm" loading={busy === "publish"} onClick={() => void run("publish", () => api(`/dashboard/pages/${store.home!.id}/publish`, { method: "POST" }), t.published)}>
            {t.publishHome}
          </Button>
        ),
      });
    if (!enabled) missing.push({ key: "enabled" });
    if (enabled && homePublished && !store.live) missing.push({ key: "theme" });
  }

  async function copy() {
    if (!session.storeUrl) return;
    try {
      await navigator.clipboard.writeText(session.storeUrl);
      toast.success(t.copied);
    } catch {
      toast.error(ar.errors.generic);
    }
  }

  return (
    <Panel className={cn(store.live ? "border-success/40" : "border-border")}>
      <PanelBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={cn("flex items-center gap-2 text-lg font-bold", store.live ? "text-success" : "text-ink-2")}>
              {store.live ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
              {store.live ? t.live : t.off}
            </p>
            {session.storeUrl ? (
              <p dir="ltr" className="mt-1 text-start text-sm text-ink-2">
                {session.storeUrl.replace(/^https?:\/\//, "")}
              </p>
            ) : null}
            {store.exists ? <p className="text-xs text-ink-3">{t.counts(store.counts.products, store.counts.categories)}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {session.storeUrl ? (
              <>
                <Button size="sm" variant="outline" onClick={() => void copy()}>
                  <Copy />
                  {t.copyLink}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={session.storeUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                    {t.open}
                  </a>
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {store.exists && allowed ? (
          <SwitchRow
            title={t.enable}
            description={t.enableHint}
            checked={enabled}
            disabled={busy !== null}
            onCheckedChange={(on) => void run("enable", () => api("/dashboard/store", { method: "PUT", body: { is_enabled: on } }), on ? t.turnedOn : t.turnedOff)}
          />
        ) : null}

        {missing.length > 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface-2/60 p-3">
            <p className="mb-2 text-sm font-semibold">{t.whyOff}</p>
            <ul className="flex flex-col gap-2">
              {missing.map((m) => (
                <li key={m.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                    {t.reasons[m.key]}
                  </span>
                  {m.action}
                </li>
              ))}
            </ul>
            {missing.some((m) => m.key === "home") ? <p className="mt-2 text-xs text-ink-3">{t.homeHint}</p> : null}
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function General() {
  const session = useSession();
  const router = useRouter();
  const [name, setName] = React.useState(session.tenant?.name ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const dirty = name.trim() !== (session.tenant?.name ?? "");

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("/dashboard/store", { method: "PATCH", body: { name: name.trim() } });
      toast.success(t.saved);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const brand = session.store_name && session.store_name !== session.tenant?.name ? session.store_name : null;

  return (
    <Panel>
      <PanelHeader title={t.general} />
      <PanelBody className="flex flex-col gap-3">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field label={t.name} htmlFor="store-name" hint={brand ? `${t.nameHint} ${t.nameFromIdentity(brand)}` : t.nameHint} required>
          <Input id="store-name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </PanelBody>
      {dirty ? (
        <PanelFooter>
          <Button loading={busy} disabled={name.trim().length < 2} onClick={() => void save()}>
            {ar.common.save}
          </Button>
        </PanelFooter>
      ) : null}
    </Panel>
  );
}

function Display({ store }: { store: Extract<StoreState, { exists: true }> }) {
  const client = useQueryClient();
  const [values, setValues] = React.useState<StoreSettings>(store.settings);
  const [busy, setBusy] = React.useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(store.settings);

  async function save() {
    setBusy(true);
    try {
      await api("/dashboard/store", { method: "PUT", body: { settings: { ...values, announcement: values.announcement?.trim() || null } } });
      toast.success(t.saved);
      await client.invalidateQueries({ queryKey: ["store"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader title={t.display} />
      <PanelBody className="flex flex-col gap-3">
        <Field label={t.announcement} htmlFor="store-announcement" hint={t.announcementHint}>
          <Input id="store-announcement" maxLength={200} value={values.announcement ?? ""} onChange={(e) => setValues({ ...values, announcement: e.target.value })} />
        </Field>
        <Field label={t.perPage} htmlFor="store-per-page">
          <Select
            id="store-per-page"
            value={String(values.products_per_page)}
            onValueChange={(v) => setValues({ ...values, products_per_page: Number(v) })}
            options={[12, 16, 24, 32, 48].map((n) => ({ value: String(n), label: String(n) }))}
            searchable={false}
            className="sm:w-40"
          />
        </Field>
        <SwitchRow title={t.showWhatsapp} description={t.showWhatsappHint} checked={values.show_whatsapp} onCheckedChange={(v) => setValues({ ...values, show_whatsapp: v })} />
        <SwitchRow title={t.showOutOfStock} description={t.showOutOfStockHint} checked={values.show_out_of_stock} onCheckedChange={(v) => setValues({ ...values, show_out_of_stock: v })} />
      </PanelBody>
      {dirty ? (
        <PanelFooter>
          <Button variant="outline" onClick={() => setValues(store.settings)}>
            {ar.common.cancel}
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            {ar.common.save}
          </Button>
        </PanelFooter>
      ) : null}
    </Panel>
  );
}

/** Only cash on delivery works for now; the rest are shown as coming soon (owner decision). */
function Payments() {
  return (
    <Panel>
      <PanelHeader title={t.payments} description={t.paymentsHint} />
      <ul className="divide-y divide-border">
        {PAYMENT_METHODS.map((m) => (
          <li key={m.key} className={cn("flex items-center gap-3 px-5 py-3", !m.active && "opacity-60")}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
              <m.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t.methods[m.key].title}</span>
              <span className="block text-xs text-ink-3">{t.methods[m.key].description}</span>
            </span>
            {m.active ? (
              <Badge tone="success" size="sm">
                {t.active}
              </Badge>
            ) : (
              <Badge size="sm">
                <Lock />
                {t.soon}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
