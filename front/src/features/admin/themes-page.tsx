"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ImageOff, Layers } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/choice";
import { EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { formatMoney } from "@/lib/format";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import { toggleTheme, useAdminThemeList, type AdminThemeRow } from "./catalog-api";

const t = ar.admin.themes;
const TABS = ["all", "store", "landing"] as const;

export function ThemesPage() {
  const [url, setUrl] = useUrlState(["kind"] as const);
  const kind = (TABS as readonly string[]).includes(url.kind) ? (url.kind as (typeof TABS)[number]) : "all";
  const query = useAdminThemeList();
  const themes = (query.data?.data ?? []).filter((th) => kind === "all" || th.kind === kind);

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        tabs={
          <Tabs value={kind} onValueChange={(v) => setUrl({ kind: v === "all" ? null : v })}>
            <TabsList>
              {TABS.map((k) => (
                <TabsTrigger key={k} value={k}>
                  {t.tabs[k]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />
      {query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : themes.length === 0 ? (
        <EmptyState icon={Layers} title={t.empty} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map((theme) => (
            <li key={theme.key}>
              <ThemeCard theme={theme} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ThemeCard({ theme }: { theme: AdminThemeRow }) {
  const client = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const cover = theme.cover?.medium ?? theme.cover?.large ?? null;

  async function toggle(on: boolean) {
    setBusy(true);
    try {
      await toggleTheme(theme.key, on);
      toast.success(t.toggled(on));
      await client.invalidateQueries({ queryKey: ["admin", "themes"] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <Link href={`/admin/themes/${theme.key}`} className="block aspect-[16/10] overflow-hidden bg-surface-2">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- platform media, already resized
          <img src={cover} alt={theme.name} className="h-full w-full object-cover transition-transform hover:scale-[1.02]" />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-2 text-sm text-ink-3">
            <ImageOff className="size-6" aria-hidden />
            {t.noCover}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/admin/themes/${theme.key}`} className="font-display text-lg font-semibold hover:underline">
            {theme.name}
          </Link>
          <span className="tabular font-semibold">{theme.is_free ? t.free : formatMoney(theme.price?.final ?? 0)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge size="sm" tone={theme.kind === "store" ? "brand-soft" : "info"}>
            {t.kinds[theme.kind]}
          </Badge>
          {theme.is_featured ? <Badge size="sm" tone="attention">{t.featured}</Badge> : null}
          {!theme.is_listed ? <Badge size="sm" tone="warning">{t.unlisted}</Badge> : null}
        </div>
        <p className="text-xs text-ink-3">
          {t.inUse(theme.in_use)} · {t.sales(theme.sales)}
        </p>
        <label className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
          <span className={theme.is_active ? "text-success" : "text-ink-3"}>{theme.is_active ? t.active : t.inactive}</span>
          <Switch checked={theme.is_active} disabled={busy} onCheckedChange={(on) => void toggle(on)} aria-label={`${t.active}: ${theme.name}`} />
        </label>
      </div>
    </article>
  );
}
