"use client";

import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ar } from "@/messages/ar";

const t = ar.support;

type Stats = {
  days: number;
  opened: number;
  closed: number;
  auto_closed: number;
  waiting_now: number;
  first_reply_minutes: number | null;
  resolution_minutes: number | null;
  rating: number | null;
  rated: number;
  satisfied_percent: number | null;
  resolved_percent: number | null;
  stars: Record<string, number>;
  topics: Record<string, number>;
  daily: Array<{ date: string; count: number }>;
  low_ratings: Array<{ number: number; store: string | null; rating: number; resolved: boolean | null; comment: string | null; rated_at: string | null }>;
};

const PERIODS = ["7", "30", "90", "365"] as const;

/** «الأداء»: how fast and how well support answers (from the merchants' own ratings). */
export function SupportStats() {
  const [days, setDays] = React.useState<(typeof PERIODS)[number]>("30");
  const query = useQuery({ queryKey: ["support", "support", "stats", days], queryFn: () => api<Stats>("/admin/support/stats", { query: { days } }) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{t.stats.title}</h2>
        <Segmented value={days} onChange={setDays} options={PERIODS.map((d) => ({ value: d, label: t.stats.period(Number(d)) }))} />
      </div>
      {query.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <StatsBody s={query.data} />
      )}
    </div>
  );
}

function StatsBody({ s }: { s: Stats }) {
  const max = Math.max(1, ...s.daily.map((d) => d.count));
  const starMax = Math.max(1, ...Object.values(s.stars));
  const topicMax = Math.max(1, ...Object.values(s.topics));
  const minutes = (m: number | null) => (m === null ? t.stats.none : t.stats.minutes(m));
  const percent = (p: number | null) => (p === null ? t.stats.none : `${formatNumber(p)}%`);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t.stats.opened} value={formatNumber(s.opened)} hint={t.stats.autoClosed(s.auto_closed)} />
        <Tile label={t.stats.waiting} value={formatNumber(s.waiting_now)} tone={s.waiting_now > 0 ? "text-accent-ink" : undefined} />
        <Tile label={t.stats.firstReply} value={minutes(s.first_reply_minutes)} />
        <Tile label={t.stats.resolution} value={minutes(s.resolution_minutes)} />
        <Tile label={t.stats.rating} value={s.rating === null ? t.stats.none : `${formatNumber(s.rating)} ★`} hint={t.stats.rated(s.rated)} tone="text-accent-ink" />
        <Tile label={t.stats.satisfied} value={percent(s.satisfied_percent)} tone="text-success" />
        <Tile label={t.stats.resolved} value={percent(s.resolved_percent)} tone="text-success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t.stats.daily}>
          <div className="flex h-32 items-end gap-[2px]" role="img" aria-label={t.stats.daily}>
            {s.daily.map((d) => (
              <div key={d.date} title={`${d.date}: ${d.count}`} className="min-w-[2px] flex-1 rounded-t bg-chart-1" style={{ height: `${Math.max(2, (d.count / max) * 100)}%`, opacity: d.count ? 1 : 0.25 }} />
            ))}
          </div>
        </Card>
        <Card title={t.stats.stars}>
          <ul className="flex flex-col gap-1.5">
            {[5, 4, 3, 2, 1].map((n) => (
              <li key={n} className="flex items-center gap-2 text-sm">
                <span className="flex w-8 items-center gap-0.5 tabular">
                  {n}
                  <Star className="size-3 fill-accent text-accent" aria-hidden />
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${((s.stars[String(n)] ?? 0) / starMax) * 100}%` }} />
                </span>
                <span className="w-8 text-end text-xs tabular text-ink-3">{formatNumber(s.stars[String(n)] ?? 0)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={t.stats.topics}>
          <ul className="flex flex-col gap-1.5">
            {Object.entries(s.topics).map(([topic, n]) => (
              <li key={topic} className="flex items-center gap-2 text-sm">
                <span className="w-28 truncate">{t.topics[topic] ?? topic}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-chart-2" style={{ width: `${(n / topicMax) * 100}%` }} />
                </span>
                <span className="w-8 text-end text-xs tabular text-ink-3">{formatNumber(n)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={t.stats.low}>
          {s.low_ratings.length === 0 ? (
            <p className="text-sm text-ink-3">{t.stats.noLow}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {s.low_ratings.map((r) => (
                <li key={r.number} className="py-2 text-sm">
                  <p className="flex items-center gap-2">
                    <Link href={`/admin/support?status=all&ticket=${r.number}`} className="font-semibold text-primary tabular">
                      {t.ticket(r.number)}
                    </Link>
                    <span className="truncate">{r.store}</span>
                    <span className="ms-auto text-accent-ink">{"★".repeat(r.rating)}</span>
                  </p>
                  {r.comment ? <p className="text-xs text-ink-2">{r.comment}</p> : null}
                  {r.rated_at ? <p className="text-[11px] text-ink-3">{formatDateTime(r.rated_at)}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tabular ${tone ?? ""}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}
