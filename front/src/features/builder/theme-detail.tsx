"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Eye, Paintbrush, Power, ShoppingBag } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Panel, PanelBody } from "@/components/ui/panel";
import { useStore } from "@/features/store/store-page";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { THEME_DEMOS, THEME_SHOTS } from "@/themes/registry";
import { useStoreTheme } from "./api";

const t = ar.design.page;
const d = t.detail;

/** A store theme's page: its pictures, what it has, its price, and buy / switch / try it. */
export function StoreThemeDetail({ themeKey }: { themeKey: string }) {
  const query = useStoreTheme(themeKey);
  const store = useStore();
  const client = useQueryClient();
  const [shot, setShot] = React.useState(0);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  if (query.isPending) return <Skeleton className="h-[34rem] rounded-xl" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;

  const theme = query.data;
  const mine = store.data?.exists ? store.data.themes.find((x) => x.key === theme.key) : theme.key === "asas" ? { active: true } : undefined;
  const owned = theme.is_free || theme.owned === true || mine !== undefined;
  const active = mine?.active === true;
  const uploaded = (theme.images ?? []).map((i) => i.urls.large ?? i.urls.medium ?? Object.values(i.urls)[0]).filter(Boolean);
  const shots = [...uploaded, ...(THEME_SHOTS[theme.key] ?? [])];
  const price = theme.price;
  const demo = THEME_DEMOS.has(theme.key) ? `/dashboard/design/themes/${encodeURIComponent(theme.key)}/demo` : "/dashboard/design/preview";

  async function activate() {
    setBusy(true);
    try {
      await api("/dashboard/store", { method: "PUT", body: { theme_key: theme.key } });
      await client.invalidateQueries({ queryKey: ["store"] });
      toast.success(t.activated(theme.name));
      setConfirming(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader crumbs={[{ label: d.back, href: "/dashboard/design/theme" }, { label: theme.name }]} title={theme.name} description={theme.short_description ?? undefined} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-3">
          {shots.length ? (
            <>
              <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- static screenshots or platform media */}
                <img src={shots[Math.min(shot, shots.length - 1)]} alt={theme.name} className="w-full" />
              </div>
              {shots.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto">
                  {shots.map((src, i) => (
                    <button key={src} type="button" onClick={() => setShot(i)} className={cn("h-20 w-32 shrink-0 overflow-hidden rounded-lg border-2", i === shot ? "border-brand" : "border-transparent opacity-70 hover:opacity-100")} aria-label={d.shot(i + 1)} aria-current={i === shot}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- static screenshots or platform media */}
                      <img src={src} alt="" className="size-full object-cover object-top" />
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          {theme.description ? (
            <Panel>
              <PanelBody>
                <p className="mb-2 font-semibold">{d.about}</p>
                <p className="text-sm leading-7 text-ink-2">{theme.description}</p>
              </PanelBody>
            </Panel>
          ) : null}
        </div>

        <Panel className="lg:sticky lg:top-20">
          <PanelBody className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-ink-3">{d.price}</span>
              {theme.is_free || !price ? (
                <Badge>{d.free}</Badge>
              ) : (
                <span className="flex items-baseline gap-2">
                  <b className="tabular text-xl">{formatMoney(price.final)}</b>
                  {price.discount_percent > 0 ? <s className="tabular text-sm text-ink-3">{formatMoney(price.original)}</s> : null}
                </span>
              )}
            </div>
            {price && price.discount_percent > 0 && !owned ? (
              <div className="flex flex-col gap-1 rounded-lg bg-danger-soft/60 px-3 py-2 text-sm">
                <span className="font-semibold text-danger">{d.discount(price.discount_percent)}</span>
                {price.discount_ends_at ? (
                  <span className="flex items-center gap-1 text-xs text-ink-2">
                    <Clock className="size-3.5" aria-hidden />
                    {d.discountEnds(formatDateTime(price.discount_ends_at))}
                  </span>
                ) : null}
              </div>
            ) : null}
            {owned ? <Badge tone={active ? "success" : "neutral"} dot>{active ? d.active : d.owned}</Badge> : null}

            {theme.features?.length ? (
              <div>
                <p className="mb-2 text-[13px] font-semibold">{d.features}</p>
                <ul className="flex flex-col gap-1.5">
                  {theme.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {theme.tags?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {theme.tags.map((tag) => (
                  <Badge key={tag.id} size="sm">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              {active ? (
                <Button asChild>
                  <Link href="/dashboard/design/builder">
                    <Paintbrush />
                    {t.customize}
                  </Link>
                </Button>
              ) : owned ? (
                <Button onClick={() => setConfirming(true)}>
                  <Power />
                  {t.activate}
                </Button>
              ) : (
                <Button asChild>
                  <Link href={`/dashboard/settings/billing/checkout?theme=${encodeURIComponent(theme.key)}`}>
                    <ShoppingBag />
                    {t.buy}
                    {price ? <span className="tabular">· {formatMoney(price.final)}</span> : null}
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href={demo} target="_blank">
                  <Eye />
                  {t.demo}
                </Link>
              </Button>
              <p className="text-xs text-ink-3">{THEME_DEMOS.has(theme.key) ? d.demoHint : null}</p>
              {!theme.is_free && !owned ? <p className="text-xs text-ink-3">{d.oneTime}</p> : null}
              {owned && theme.can_publish === false ? <p className="text-xs text-warning">{t.needsPlan}</p> : null}
            </div>
          </PanelBody>
        </Panel>
      </div>
      <ConfirmDialog open={confirming} onOpenChange={setConfirming} title={t.activateTitle(theme.name)} description={t.activateText} confirmLabel={t.activate} loading={busy} onConfirm={() => void activate()} />
    </>
  );
}
