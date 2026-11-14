"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";
import { Avatar, Thumb } from "@/components/ui/panel";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

/** A row about one thing: product with its image, customer with name + phone, a store... */
export function EntityCell({ title, subtitle, image, avatar, meta, className }: { title: React.ReactNode; subtitle?: React.ReactNode; image?: string | null; avatar?: string; meta?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {avatar !== undefined ? <Avatar name={avatar} size={34} /> : image !== undefined ? <Thumb src={image} size={40} /> : null}
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink">
          <span className="truncate">{title}</span>
          {meta}
        </p>
        {subtitle ? <p className="truncate text-xs text-ink-3">{subtitle}</p> : null}
      </div>
    </div>
  );
}

/** Label / value pairs (order details, customer details). */
export function DescriptionList({ items, columns = 2, className }: { items: Array<{ label: string; value: React.ReactNode; wide?: boolean }>; columns?: 1 | 2 | 3; className?: string }) {
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", cols[columns], className)}>
      {items.map((item) => (
        <div key={item.label} className={item.wide ? "sm:col-span-full" : undefined}>
          <dt className="text-xs text-ink-3">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-ink">{item.value === null || item.value === undefined || item.value === "" ? <span className="text-ink-3">—</span> : item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type TimelineEvent = { id: string | number; title: React.ReactNode; by?: string; at: string; body?: React.ReactNode; tone?: "neutral" | "brand" | "success" | "danger" | "attention"; icon?: React.ReactNode };

/** History of something (order statuses, notes, who did what and when), newest first. */
export function Timeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  const tones = { neutral: "bg-surface-2 text-ink-2", brand: "bg-brand-soft text-brand-strong", success: "bg-success-soft text-success", danger: "bg-danger-soft text-danger", attention: "bg-accent-soft text-accent-ink" };
  return (
    <ol className={cn("relative flex flex-col gap-5", className)}>
      {events.map((event, i) => (
        <li key={event.id} className="relative flex gap-3">
          {i < events.length - 1 ? <span className="absolute start-[15px] top-8 h-[calc(100%-4px)] w-px bg-border" aria-hidden /> : null}
          <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4", tones[event.tone ?? "neutral"])}>{event.icon ?? <span className="size-2 rounded-full bg-current" />}</span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-semibold">
                {event.title}
                {event.by ? <span className="ms-2 text-xs font-normal text-ink-3">{event.by}</span> : null}
              </p>
              <time className="tabular text-xs text-ink-3" dir="ltr">
                {event.at}
              </time>
            </div>
            {event.body ? <div className="mt-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2">{event.body}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A value to copy as-is (transfer account, store code, link). */
export function CopyField({ label, value, className }: { label: string; value: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className={className}>
      <p className="text-xs text-ink-3">{label}</p>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-surface-2/60 ps-3">
        <span dir="ltr" className="tabular flex-1 truncate py-2 text-start text-sm font-semibold">
          {value}
        </span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(value).catch(() => undefined);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-ink-2 hover:text-ink"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {copied ? ar.common.copied : ar.common.copy}
        </button>
      </div>
    </div>
  );
}

/** Price with the old price struck and the saving. */
export function Price({ value, compareAt, size = "md" }: { value: number; compareAt?: number | null; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-xl" };
  const off = compareAt && compareAt > value ? Math.round(((compareAt - value) / compareAt) * 100) : null;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <span className={cn("tabular font-semibold", sizes[size])}>{formatMoney(value)}</span>
      {off ? (
        <>
          <span className="tabular text-xs text-ink-3 line-through">{formatMoney(compareAt)}</span>
          <span className="tabular rounded bg-danger-soft px-1 text-[11px] font-bold text-danger" dir="ltr">
            -{off}%
          </span>
        </>
      ) : null}
    </span>
  );
}

/** Setup steps with done / not done (store launch checklist). */
export function Checklist({ items }: { items: Array<{ label: string; done: boolean; action?: React.ReactNode }> }) {
  const done = items.filter((i) => i.done).length;
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${(done / Math.max(1, items.length)) * 100}%` }} />
        </div>
        <span className="tabular text-xs text-ink-3" dir="ltr">
          {done}/{items.length}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-3 py-2.5">
            <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", item.done ? "border-success bg-success text-white" : "border-border-strong")}>{item.done ? <Check className="size-3" strokeWidth={3} /> : null}</span>
            <span className={cn("flex-1 text-sm", item.done && "text-ink-3 line-through")}>{item.label}</span>
            {!item.done && item.action ? item.action : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Steps of a wizard (create a page: theme → product → publish). */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={step} className="flex items-center gap-2">
            <span className={cn("tabular flex size-6 items-center justify-center rounded-full text-xs font-bold", state === "done" ? "bg-success text-white" : state === "current" ? "bg-ink text-white" : "bg-surface-3 text-ink-3")}>
              {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("text-sm", state === "todo" ? "text-ink-3" : "font-semibold")}>{step}</span>
            {i < steps.length - 1 ? <span className="mx-1 h-px w-8 bg-border-strong" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}
