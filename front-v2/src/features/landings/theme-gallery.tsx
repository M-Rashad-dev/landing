"use client";

import { Eye, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { errorMessage } from "@/lib/api/errors";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { useLandingThemes, type LandingTheme } from "./api";
import { CreateLandingDialog } from "./create-dialog";

const t = ar.landings.gallery;

/** «إضافة صفحة»: the free theme(s) on top, the paid ones to browse under them. */
export function ThemeGallery() {
  const query = useLandingThemes();
  const [creating, setCreating] = React.useState<LandingTheme | null>(null);
  const free = (query.data ?? []).filter((th) => th.is_free || th.owned);
  const paid = (query.data ?? []).filter((th) => !th.is_free && !th.owned);

  return (
    <>
      <PageHeader crumbs={[{ label: t.back, href: "/dashboard/marketing/landings" }, { label: t.title }]} title={t.title} description={t.description} />
      {query.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <div className="flex flex-col gap-6">
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {free.map((theme) => (
              <li key={theme.key}>
                <ThemeCard theme={theme} onUse={() => setCreating(theme)} />
              </li>
            ))}
          </ul>

          <Panel>
            <PanelHeader title={t.paid} description={t.paidHint} />
            <PanelBody>
              {paid.length === 0 ? (
                <EmptyState compact icon={Sparkles} title={ar.common.soon} description={t.paidSoon} />
              ) : (
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {paid.map((theme) => (
                    <li key={theme.key}>
                      <ThemeCard theme={theme} />
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>
      )}
      <CreateLandingDialog theme={creating} onClose={() => setCreating(null)} />
    </>
  );
}

export function ThemeCard({ theme, onUse }: { theme: LandingTheme; onUse?: () => void }) {
  const cover = theme.cover?.medium ?? theme.cover?.large ?? null;
  const details = `/dashboard/marketing/landings/themes/${encodeURIComponent(theme.key)}`;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <Link href={details} className="relative block aspect-[16/10] overflow-hidden border-b border-border bg-surface-2">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- platform media, already resized
          <img src={cover} alt={theme.name} className="size-full object-cover object-top transition-transform hover:scale-[1.02]" />
        ) : (
          <LandingSketch />
        )}
        {theme.price && theme.price.discount_percent > 0 ? (
          <Badge tone="danger" className="absolute start-3 top-3">
            {ar.landings.theme.discount(theme.price.discount_percent)}
          </Badge>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={details} className="font-display text-lg font-semibold hover:underline">
            {theme.name}
          </Link>
          <ThemePriceTag theme={theme} />
        </div>
        {theme.short_description ? <p className="text-sm text-ink-2">{theme.short_description}</p> : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          {onUse ? (
            <Button onClick={onUse}>{t.use}</Button>
          ) : (
            <Button disabled variant="outline">
              <Lock />
              {ar.landings.theme.buySoon}
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link href={details}>
              <Eye />
              {t.details}
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ThemePriceTag({ theme }: { theme: LandingTheme }) {
  if (theme.owned && !theme.is_free) return <Badge tone="success">{t.owned}</Badge>;
  if (theme.is_free || !theme.price) return <Badge tone="brand-soft">{t.free}</Badge>;
  return (
    <span className="flex flex-col items-end">
      <span className="tabular font-semibold">{formatMoney(theme.price.final)}</span>
      {theme.price.discount_percent > 0 ? <span className="tabular text-xs text-ink-3 line-through">{formatMoney(theme.price.original)}</span> : null}
    </span>
  );
}

/** A drawing of a one-product page, for a theme that has no screenshot yet. */
export function LandingSketch() {
  return (
    <svg viewBox="0 0 320 200" className="size-full" aria-hidden>
      <rect width="320" height="200" className="fill-surface-2" />
      <g transform="translate(110 14)">
        <rect width="100" height="186" rx="12" className="fill-surface stroke-border" strokeWidth="2" />
        <rect x="10" y="12" width="30" height="6" rx="3" className="fill-ink/30" />
        <rect x="10" y="26" width="80" height="54" rx="6" className="fill-brand/25" />
        <rect x="10" y="88" width="62" height="7" rx="3" className="fill-ink/40" />
        <rect x="10" y="99" width="44" height="5" rx="2.5" className="fill-ink/20" />
        <rect x="10" y="110" width="34" height="8" rx="3" className="fill-brand" />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={20 + i * 30} cy="134" r="7" className="fill-brand/30" />
        ))}
        <rect x="10" y="150" width="80" height="26" rx="6" className="fill-ink/10" />
        <rect x="18" y="158" width="64" height="10" rx="5" className="fill-brand" />
      </g>
    </svg>
  );
}
