"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import * as React from "react";
import { EmptyState } from "@/components/ui/feedback";
import { formatDayShort, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

/**
 * Charts read their colors from the tokens (--chart-1..4) — never more than 4 series.
 * Time runs right → left (RTL): the newest day is on the left, the value axis on the right.
 */
const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"] as const;

export type Series = { key: string; label: string };
type Row = { date: string } & Record<string, number | string>;

const axis = { fontSize: 11, fill: "var(--ink-3)" };

function ChartTooltip({ active, payload, label, format }: Partial<TooltipContentProps<number, string>> & { format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div dir="rtl" className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{typeof label === "string" ? formatDayShort(label) : label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-ink-2">{p.name}</span>
          <span className="tabular ms-auto font-semibold">{format(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-ink-2">
      {series.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: SERIES[i] }} aria-hidden />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function ChartBox({ height, empty, children, className }: { height: number; empty: boolean; children: React.ReactElement; className?: string }) {
  if (empty) return <EmptyState title={ar.showcase.charts.empty} compact />;
  return (
    <div className={cn("w-full", className)} style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/** One series per day, soft area (sales / visits per day). */
export function DailyAreaChart({ data, series, height = 240, format = formatNumber }: { data: Row[]; series: Series; height?: number; format?: (v: number) => string }) {
  const empty = data.every((d) => !Number(d[series.key]));
  return (
    <ChartBox height={height} empty={empty}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="mk-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.22} />
            <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" reversed tickFormatter={formatDayShort} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis orientation="right" tick={axis} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => formatNumber(v)} />
        <Tooltip content={<ChartTooltip format={format} />} cursor={{ stroke: "var(--border-strong)" }} />
        <Area type="monotone" dataKey={series.key} name={series.label} stroke={SERIES[0]} strokeWidth={2} fill="url(#mk-area)" />
      </AreaChart>
    </ChartBox>
  );
}

/** 2–4 series compared over time (orders vs cancellations). */
export function MultiLineChart({ data, series, height = 240, format = formatNumber }: { data: Row[]; series: Series[]; height?: number; format?: (v: number) => string }) {
  const empty = data.every((d) => series.every((s) => !Number(d[s.key])));
  return (
    <ChartBox height={height} empty={empty}>
      <LineChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" reversed tickFormatter={formatDayShort} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis orientation="right" tick={axis} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<ChartTooltip format={format} />} cursor={{ stroke: "var(--border-strong)" }} />
        {series.slice(0, 4).map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    </ChartBox>
  );
}

/** Bars per day (orders per day). */
export function DailyBarChart({ data, series, height = 220, format = formatNumber }: { data: Row[]; series: Series; height?: number; format?: (v: number) => string }) {
  const empty = data.every((d) => !Number(d[series.key]));
  return (
    <ChartBox height={height} empty={empty}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" reversed tickFormatter={formatDayShort} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis orientation="right" tick={axis} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <Tooltip content={<ChartTooltip format={format} />} cursor={{ fill: "var(--surface-2)" }} />
        <Bar dataKey={series.key} name={series.label} fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartBox>
  );
}

/** Ranked bars (traffic sources, top products) — plain HTML, readable on any width. */
export function RankBars({ items, format = formatNumber }: { items: Array<{ label: string; value: number; hint?: string }>; format?: (v: number) => string }) {
  if (items.length === 0) return <EmptyState title={ar.showcase.charts.empty} compact />;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
            <span className="truncate">{item.label}</span>
            <span className="tabular shrink-0 text-ink-3">
              {format(item.value)}
              {item.hint ? ` · ${item.hint}` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Purchase funnel: each step with its share of the first one and the drop from the previous. */
export function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const first = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step, i) => {
        const share = (step.value / first) * 100;
        const prev = i > 0 ? steps[i - 1].value : null;
        const drop = prev ? Math.round(((prev - step.value) / Math.max(1, prev)) * 100) : null;
        return (
          <li key={step.label} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-[13px]">
            <span className="truncate text-ink-2">{step.label}</span>
            <div className="h-7 overflow-hidden rounded-md bg-surface-2">
              <div className="flex h-full items-center rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-ink" style={{ width: `${Math.min(100, Math.max(4, share))}%` }}>
                <span className="tabular" dir="ltr">{Math.round(share)}%</span>
              </div>
            </div>
            <span className="tabular w-24 text-end">
              {formatNumber(step.value)}
              {drop !== null && drop > 0 ? <span className="ms-1 text-xs text-danger" dir="ltr">-{drop}%</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
