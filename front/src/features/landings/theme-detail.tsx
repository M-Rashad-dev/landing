"use client";

import { Check, Clock, ShoppingBag } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Panel, PanelBody } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { cn } from "@/lib/utils";
import { THEME_SHOTS } from "@/themes/registry";
import { useLandingTheme } from "./api";
import { CreateLandingDialog } from "./create-dialog";
import { buyUrl, LandingSketch, ThemePriceTag } from "./theme-gallery";

const t = ar.landings.theme;

/** A theme's page: its screenshots, what it has, its price and any running discount. */
export function ThemeDetail({ themeKey }: { themeKey: string }) {
  const query = useLandingTheme(themeKey);
  const [creating, setCreating] = React.useState(false);
  const [kind, setKind] = React.useState<"cover" | "desktop" | "mobile">("cover");
  const [shot, setShot] = React.useState(0);

  if (query.isPending) return <Skeleton className="h-[30rem] rounded-xl" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const theme = query.data;
  const usable = theme.is_free || theme.owned === true;
  const images = theme.images ?? [];
  const kinds = (["cover", "desktop", "mobile"] as const).filter((k) => images.some((i) => i.kind === k));
  const shown = images.filter((i) => i.kind === (kinds.includes(kind) ? kind : kinds[0]));
  const price = theme.price;

  return (
    <>
      <PageHeader crumbs={[{ label: t.back, href: "/dashboard/marketing/landings/new" }, { label: theme.name }]} title={theme.name} description={theme.short_description ?? undefined} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-3">
          {kinds.length > 1 ? <Segmented value={kinds.includes(kind) ? kind : kinds[0]} onChange={setKind} options={kinds.map((k) => ({ value: k, label: t.shots[k] }))} /> : null}
          {shown.length === 0 && THEME_SHOTS[theme.key] ? (
            <ShippedShots shots={THEME_SHOTS[theme.key]} name={theme.name} current={shot} onPick={setShot} />
          ) : shown.length === 0 ? (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="aspect-[16/10]">
                <LandingSketch />
              </div>
              <p className="border-t border-border bg-surface px-4 py-2 text-center text-xs text-ink-3">{t.noShots}</p>
            </div>
          ) : (
            shown.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element -- platform media, already resized
              <img key={image.id} src={image.urls.large ?? image.urls.medium} alt={theme.name} className="w-full rounded-xl border border-border bg-surface-2" />
            ))
          )}
          {theme.description ? <p className="text-sm leading-relaxed text-ink-2">{theme.description}</p> : null}
        </div>

        <Panel className="lg:sticky lg:top-20">
          <PanelBody className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-ink-3">{t.price}</span>
              <ThemePriceTag theme={theme} />
            </div>
            {price && price.discount_percent > 0 ? (
              <div className="flex flex-col gap-1 rounded-lg bg-danger-soft/60 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 font-semibold text-danger">
                  {t.discount(price.discount_percent)}
                  <span className="tabular text-xs font-normal text-ink-3 line-through">{t.was(price.original)}</span>
                </span>
                {price.discount_ends_at ? (
                  <span className="flex items-center gap-1 text-xs text-ink-2">
                    <Clock className="size-3.5" aria-hidden />
                    {t.discountEnds(formatDateTime(price.discount_ends_at))}
                  </span>
                ) : null}
              </div>
            ) : null}
            {theme.features && theme.features.length > 0 ? (
              <div>
                <p className="mb-2 text-[13px] font-semibold">{t.features}</p>
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
            {theme.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {theme.tags.map((tag) => (
                  <Badge key={tag.id} size="sm">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            ) : null}
            {theme.min_plan && !usable ? <p className="text-xs text-ink-3">{t.minPlan(theme.min_plan.name)}</p> : null}
            {usable ? (
              <Button onClick={() => setCreating(true)}>{ar.landings.gallery.use}</Button>
            ) : (
              <Button asChild>
                <Link href={buyUrl(theme.key)}>
                  <ShoppingBag />
                  {t.buy}
                  {price ? <span className="tabular">· {formatMoney(price.final)}</span> : null}
                </Link>
              </Button>
            )}
            {usable && theme.can_publish === false ? <p className="text-xs text-warning">{t.needsPlan}</p> : null}
            {!usable ? <p className="text-xs text-ink-3">{t.oneTime}</p> : null}
          </PanelBody>
        </Panel>
      </div>
      <CreateLandingDialog theme={creating ? theme : null} onClose={() => setCreating(false)} />
    </>
  );
}

/** The pictures shipped with the theme (public/themes/{key}): one big, the rest to pick from. */
function ShippedShots({ shots, name, current, onPick }: { shots: string[]; name: string; current: number; onPick: (i: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- shipped static picture */}
      <img src={shots[current] ?? shots[0]} alt={name} className="aspect-[16/10] w-full rounded-xl border border-border bg-surface-2 object-cover" />
      <div className="grid grid-cols-6 gap-2">
        {shots.map((src, i) => (
          <button key={src} type="button" onClick={() => onPick(i)} aria-label={t.shotOf(i + 1)} aria-current={i === current} className={cn("overflow-hidden rounded-lg border-2 transition", i === current ? "border-brand" : "border-transparent opacity-70 hover:opacity-100")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- shipped static picture */}
            <img src={src} alt="" className="aspect-[16/10] w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
