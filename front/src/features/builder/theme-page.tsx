"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Eye, Paintbrush, Power, ShoppingBag } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, LockedNotice, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useStore } from "@/features/store/store-page";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { usePlanFeature } from "@/lib/auth/session-context";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { THEME_DEMOS, THEME_SHOTS } from "@/themes/registry";
import { useStoreThemes, type StoreTheme } from "./api";

const t = ar.design.page;

const shotOf = (key: string): string | null => THEME_SHOTS[key]?.[0] ?? null;
const detailOf = (key: string) => `/dashboard/design/themes/${encodeURIComponent(key)}`;

export function ThemePage() {
  const allowed = usePlanFeature("store");
  const query = useStore();
  const client = useQueryClient();
  const [activating, setActivating] = React.useState<{ key: string; name: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function activate() {
    if (!activating) return;
    setBusy(true);
    try {
      await api("/dashboard/store", { method: "PUT", body: { theme_key: activating.key } });
      await client.invalidateQueries({ queryKey: ["store"] });
      toast.success(t.activated(activating.name));
      setActivating(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {!allowed ? (
        <LockedNotice
          title={t.needsStore}
          description={t.needsStoreText}
          action={
            <Button asChild size="sm">
              <Link href="/dashboard/settings/billing">{t.upgrade}</Link>
            </Button>
          }
        />
      ) : query.isPending ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title={t.mine} />
            <PanelBody>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(query.data.exists ? query.data.themes : [{ key: "asas_store", name: "أساس", short_description: null, active: true, free: true }]).map((theme) => {
                  const design = query.data.exists ? query.data.design : null;
                  return (
                    <article key={theme.key} className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                      <Link href={detailOf(theme.key)} className="group relative block aspect-[16/10] overflow-hidden border-b border-border bg-surface-2" aria-label={`${theme.name} · ${t.details}`}>
                        {shotOf(theme.key) ? (
                          // eslint-disable-next-line @next/next/no-img-element -- static screenshot
                          <img src={shotOf(theme.key)!} alt={theme.name} className="size-full object-cover object-top transition duration-500 group-hover:scale-[1.03]" />
                        ) : null}
                        {theme.active ? (
                          <Badge tone="success" className="absolute start-3 top-3" dot>
                            {t.active}
                          </Badge>
                        ) : null}
                      </Link>
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <p className="flex items-center gap-2 text-lg font-bold">
                          <Link href={detailOf(theme.key)} className="hover:underline">
                            {theme.name}
                          </Link>
                          {theme.free ? <Badge size="sm">{t.free}</Badge> : null}
                        </p>
                        {theme.short_description ? <p className="text-sm text-ink-2">{theme.short_description}</p> : null}
                        {theme.active ? (
                          <p className="text-xs text-ink-3">
                            {design?.published_at ? t.published(formatDateTime(design.published_at)) : t.neverPublished}
                            {design?.has_unpublished_changes && design.published_at ? ` · ${t.unpublished}` : ""}
                          </p>
                        ) : null}
                        <div className="mt-auto flex flex-wrap gap-2 pt-2">
                          {theme.active ? (
                            <>
                              <Button asChild>
                                <Link href="/dashboard/design/builder">
                                  <Paintbrush />
                                  {t.customize}
                                </Link>
                              </Button>
                              <Button asChild variant="outline">
                                <Link href="/dashboard/design/preview" target="_blank">
                                  <ExternalLink />
                                  {t.preview}
                                </Link>
                              </Button>
                            </>
                          ) : (
                            <Button onClick={() => setActivating({ key: theme.key, name: theme.name })}>
                              <Power />
                              {t.activate}
                            </Button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </PanelBody>
          </Panel>

          <PaidThemes owned={query.data.exists ? query.data.themes.map((x) => x.key) : ["asas_store"]} />
        </div>
      )}
      <ConfirmDialog
        open={activating !== null}
        onOpenChange={(o) => !o && setActivating(null)}
        title={activating ? t.activateTitle(activating.name) : ""}
        description={t.activateText}
        confirmLabel={t.activate}
        loading={busy}
        onConfirm={() => void activate()}
      />
    </>
  );
}

/** Paid store themes the store does not own yet: picture, what it has, price, and «اشتريه». */
function PaidThemes({ owned }: { owned: string[] }) {
  const query = useStoreThemes();
  const themes = (query.data ?? []).filter((theme: StoreTheme) => !theme.is_free && !owned.includes(theme.key) && !theme.owned);
  return (
    <Panel>
      <PanelHeader title={t.paid} description={t.paidHint} />
      <PanelBody>
        {query.isPending ? (
          <Skeleton className="h-72 rounded-xl" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
        ) : themes.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-2">{t.noPaid}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {themes.map((theme) => {
              const shot = theme.cover?.large ?? theme.cover?.medium ?? shotOf(theme.key);
              const price = theme.price;
              return (
                <article key={theme.key} className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                  <Link href={detailOf(theme.key)} className="group relative block aspect-[16/10] overflow-hidden border-b border-border bg-surface-2" aria-label={`${theme.name} · ${t.details}`}>
                    {shot ? (
                      // eslint-disable-next-line @next/next/no-img-element -- static screenshot or platform media
                      <img src={shot} alt={theme.name} className="size-full object-cover object-top transition duration-500 group-hover:scale-[1.03]" />
                    ) : null}
                  </Link>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <p className="flex items-center justify-between gap-2">
                      <Link href={detailOf(theme.key)} className="text-lg font-bold hover:underline">
                        {theme.name}
                      </Link>
                      {price ? (
                        <span className="flex items-baseline gap-1.5">
                          <b className="tabular">{formatMoney(price.final)}</b>
                          {price.discount_percent > 0 ? <s className="tabular text-xs text-ink-3">{formatMoney(price.original)}</s> : null}
                        </span>
                      ) : null}
                    </p>
                    {theme.short_description ? <p className="text-sm text-ink-2">{theme.short_description}</p> : null}
                    {theme.features?.length ? (
                      <ul className="flex flex-col gap-1">
                        {theme.features.slice(0, 4).map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-xs text-ink-2">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                            {f}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      <Button asChild>
                        <Link href={detailOf(theme.key)}>
                          <ShoppingBag />
                          {t.buy}
                        </Link>
                      </Button>
                      {THEME_DEMOS.has(theme.key) ? (
                        <Button asChild variant="outline">
                          <Link href={`${detailOf(theme.key)}/demo`} target="_blank">
                            <Eye />
                            {t.demo}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
