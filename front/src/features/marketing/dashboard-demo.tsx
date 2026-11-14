"use client";

import { ArrowDownLeft, ArrowUpLeft, Bell, Check, ExternalLink, FileSpreadsheet, Gift, Home, Megaphone, Package, PhoneCall, Search, Settings, ShoppingBag, ShoppingCart } from "lucide-react";
import * as React from "react";
import { LogoMark } from "@/components/brand/logo";
import { Badge, type Tone } from "@/components/ui/badge";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { DEMO_INCOMING, DEMO_ORDERS, DEMO_PERIODS, demoPeriod, type DemoKpis, type DemoOrder, type DemoPeriod, type DemoStatus } from "./demo-data";

const t = ar.marketing.demo;

type View = "home" | "orders";
type Filter = "all" | DemoStatus;
type Toast = { id: number; order: DemoOrder };

const TONES: Record<DemoStatus, Tone> = { new: "attention", confirmed: "info", shipped: "brand-soft", delivered: "success", returned: "danger" };
const FILTERS: Filter[] = ["all", "new", "confirmed", "shipped", "delivered", "returned"];

/**
 * A working copy of the merchant dashboard on the marketing page: switch the period and the
 * chart, hover the days, open the orders, confirm one. Orders "arrive" while the hero is on
 * screen. Everything is local sample data; nothing is sent anywhere.
 */
export function DashboardDemo({ initialView = "home", live = false, className }: { initialView?: View; live?: boolean; className?: string }) {
  const root = React.useRef<HTMLDivElement>(null);
  const [view, setView] = React.useState<View>(initialView);
  const [period, setPeriod] = React.useState<DemoPeriod>(30);
  const [orders, setOrders] = React.useState<DemoOrder[]>(DEMO_ORDERS);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [fresh, setFresh] = React.useState<number[]>([]);
  const waiting = orders.filter((o) => o.status === "new").length;

  const notify = React.useCallback((order: DemoOrder) => {
    const id = Date.now() + order.number;
    setToasts((list) => [...list, { id, order }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 4800);
  }, []);

  // New orders drop in while the hero dashboard is on screen (twice, then it stays calm).
  React.useEffect(() => {
    if (!live || !root.current) return;
    const timers: number[] = [];
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        DEMO_INCOMING.forEach((order, i) => {
          timers.push(
            window.setTimeout(() => {
              setOrders((list) => (list.some((o) => o.number === order.number) ? list : [order, ...list]));
              setFresh((list) => [...list, order.number]);
              notify(order);
            }, 2600 + i * 7000),
          );
        });
      },
      { threshold: 0.35 },
    );
    observer.observe(root.current);
    return () => {
      observer.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [live, notify]);

  const confirm = (number: number) => setOrders((list) => list.map((o) => (o.number === number ? { ...o, status: "confirmed" } : o)));
  const extra = orders.filter((o) => fresh.includes(o.number));

  return (
    <div ref={root} dir="rtl" className={cn("@container relative flex h-full overflow-hidden bg-bg text-start text-ink", className)}>
      <Sidebar view={view} onView={setView} waiting={waiting} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex border-b border-border bg-surface px-3 py-2 @3xl:hidden">
          {(["home", "orders"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={cn("h-8 rounded-md px-3 text-[13px] font-semibold", view === v ? "bg-brand-soft text-brand-strong" : "text-ink-3")}>
              {v === "home" ? t.nav.home : t.nav.orders}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4 @3xl:p-6">
          {view === "home" ? (
            <HomeView
              period={period}
              onPeriod={setPeriod}
              waiting={waiting}
              extra={{ sales: extra.reduce((s, o) => s + o.total, 0), orders: extra.length }}
              onStart={() => {
                setFilter("new");
                setView("orders");
              }}
            />
          ) : (
            <OrdersView orders={orders} filter={filter} onFilter={setFilter} fresh={fresh} onConfirm={confirm} waiting={waiting} />
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-4 start-4 z-10 flex w-[min(340px,calc(100%-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} role="status" className="mk-toast rounded-2xl bg-ink p-4 text-white shadow-xl">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-ink">
                <ShoppingBag className="size-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{t.newOrder(toast.order.number)}</p>
                <p className="truncate text-xs text-white/60">
                  {toast.order.source === "landing" ? t.fromLanding : t.fromStore} · {toast.order.items}
                </p>
              </div>
              <span className="font-display font-semibold">{formatMoney(toast.order.total)}</span>
            </div>
            {toast.order.source === "landing" ? (
              <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-brand">
                <Gift className="size-3.5" aria-hidden />
                {t.upsellTaken}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- frame ---------- */

function Sidebar({ view, onView, waiting }: { view: View; onView: (v: View) => void; waiting: number }) {
  const item = (key: keyof typeof t.nav, Icon: typeof Home, target?: View, badge?: number) => {
    const active = target !== undefined && view === target;
    return (
      <button
        key={key}
        type="button"
        onClick={target ? () => onView(target) : undefined}
        aria-disabled={!target}
        title={target ? undefined : t.soon}
        className={cn(
          "relative flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors",
          active ? "bg-brand-soft font-semibold text-brand-strong" : target ? "text-ink-2 hover:bg-surface-2" : "cursor-default text-ink-3",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 text-start">{t.nav[key]}</span>
        {badge ? <span className="tabular rounded-full bg-accent px-1.5 text-[11px] font-bold text-ink">{badge}</span> : null}
        {active ? <span className="absolute -end-3 top-1.5 h-6 w-[3px] rounded-full bg-brand" aria-hidden /> : null}
      </button>
    );
  };
  const group = (label: string) => <p className="mt-4 mb-1 px-2.5 text-[11px] font-semibold text-ink-3">{label}</p>;
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-e border-border bg-surface p-3 @3xl:flex">
      <div className="flex items-center gap-2 px-1.5 pb-4 pt-1">
        <LogoMark size={28} />
        <span className="font-display text-lg font-bold">{ar.marketing.store.name}</span>
      </div>
      {item("home", Home, "home")}
      {group(t.groups.sales)}
      {item("orders", ShoppingBag, "orders", waiting)}
      {item("abandoned", ShoppingCart)}
      {group(t.groups.store)}
      {item("products", Package)}
      {group(t.groups.marketing)}
      {item("landings", Megaphone)}
      {item("upsells", Gift)}
      <div className="mt-auto">{item("settings", Settings)}</div>
    </aside>
  );
}

function TopBar() {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <div className="hidden h-9 max-w-80 flex-1 items-center gap-2 rounded-lg border border-border px-3 text-[13px] text-ink-3 @2xl:flex">
        <Search className="size-4" aria-hidden />
        {t.search}
      </div>
      <div className="ms-auto flex items-center gap-4 text-[13px] text-ink-2">
        <span className="hidden items-center gap-1.5 @xl:flex">
          <ExternalLink className="size-3.5" aria-hidden />
          {t.visit}
        </span>
        <span className="relative">
          <Bell className="size-[18px]" aria-hidden />
          <span className="absolute -top-0.5 -end-0.5 size-2 rounded-full bg-accent" />
        </span>
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong">س</span>
      </div>
    </div>
  );
}

/* ---------- home ---------- */

function HomeView({ period, onPeriod, waiting, extra, onStart }: { period: DemoPeriod; onPeriod: (p: DemoPeriod) => void; waiting: number; extra: { sales: number; orders: number }; onStart: () => void }) {
  const data = React.useMemo(() => demoPeriod(period), [period]);
  const kpis: DemoKpis = { ...data.kpis, sales: data.kpis.sales + extra.sales, orders: data.kpis.orders + extra.orders };
  const cards: Array<{ key: keyof DemoKpis; money?: boolean; percent?: boolean; lowerIsBetter?: boolean }> = [
    { key: "sales", money: true },
    { key: "orders" },
    { key: "aov", money: true },
    { key: "confirm", percent: true },
    { key: "delivered", percent: true },
    { key: "returned", percent: true, lowerIsBetter: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold @3xl:text-2xl">{t.hello} 👋</p>
          <p className="text-xs text-ink-3">{t.periods[String(period)]}</p>
        </div>
        <div role="radiogroup" aria-label={t.period} className="inline-flex rounded-lg bg-surface-2 p-0.5">
          {DEMO_PERIODS.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={p === period} onClick={() => onPeriod(p)} className={cn("h-8 rounded-md px-3 text-xs font-semibold transition-colors", p === period ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink")}>
              {t.periods[String(p)]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3">
        {cards.map((card) => {
          const delta = data.deltas[card.key];
          const good = card.lowerIsBetter ? delta <= 0 : delta >= 0;
          return (
            <div key={card.key} className="rounded-xl border border-border bg-surface p-3.5 @3xl:p-4">
              <p className="text-xs text-ink-2">{t.kpis[card.key]}</p>
              <p className="mt-1 font-display text-lg font-bold @3xl:text-2xl">
                <Tween value={kpis[card.key]} format={(n) => (card.money ? formatMoney(Math.round(n)) : card.percent ? `${n.toFixed(1)}%` : formatNumber(Math.round(n)))} />
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-3">
                <span className={cn("tabular inline-flex items-center gap-0.5 rounded px-1 font-semibold", good ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                  {delta >= 0 ? <ArrowUpLeft className="size-3" aria-hidden /> : <ArrowDownLeft className="size-3" aria-hidden />}
                  {Math.abs(delta).toFixed(1)}%
                </span>
                <span className="hidden @xl:inline">{t.vsBefore}</span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid items-start gap-3 @4xl:grid-cols-[1fr_17rem]">
        <SalesChart days={data.days} />
        <div className="flex flex-col rounded-xl border border-border bg-surface">
          <p className="border-b border-border px-4 py-3 text-sm font-bold">{t.needs}</p>
          <div className="flex flex-1 items-center gap-3 px-4 py-3.5">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors", waiting ? "bg-accent-soft text-accent-ink" : "bg-success-soft text-success")}>
              {waiting ? <PhoneCall className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
            </span>
            <p className="flex-1 text-[13px]">{waiting ? t.waiting(waiting) : t.allDone}</p>
            {waiting ? (
              <button type="button" onClick={onStart} className="text-xs font-bold text-primary hover:underline">
                {t.start}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A number that glides to its new value. */
function Tween({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = React.useState(value);
  const from = React.useRef(value);
  React.useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 700);
      const next = begin + (value - begin) * (1 - Math.pow(1 - p, 3));
      from.current = next;
      setShown(next);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className="tabular">{format(shown)}</span>;
}

const W = 640;
const H = 200;

function smooth(points: Array<[number, number]>): string {
  if (points.length < 2) return "";
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${Math.min(H, c1[1]).toFixed(1)} ${c2[0].toFixed(1)},${Math.min(H, c2[1]).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Sales / orders per day, newest on the left (RTL), with a hover read-out. */
function SalesChart({ days }: { days: ReturnType<typeof demoPeriod>["days"] }) {
  const [tab, setTab] = React.useState<"sales" | "orders">("sales");
  const [hover, setHover] = React.useState<number | null>(null);
  const id = React.useId();
  const values = days.map((d) => d[tab]);
  const max = Math.max(...values) * 1.12;
  const x = (i: number) => W - (i / Math.max(1, days.length - 1)) * W;
  const y = (v: number) => H - (v / max) * (H - 8);
  const points = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smooth(points);
  const area = `${line} L0,${H} L${W},${H} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((max / 1.12) * f));

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (rect.right - e.clientX) / rect.width;
    setHover(Math.max(0, Math.min(days.length - 1, Math.round(ratio * (days.length - 1)))));
  };

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="text-sm font-bold">{t.chart}</p>
        <div className="inline-flex rounded-lg bg-surface-2 p-0.5">
          {(["sales", "orders"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={cn("h-7 rounded-md px-3 text-xs font-semibold transition-colors", tab === k ? "bg-surface text-ink shadow-sm" : "text-ink-3")}>
              {t.chartTabs[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 p-4 pb-2">
        <div className="hidden flex-col-reverse justify-between pb-5 text-[10px] text-ink-3 @xl:flex">
          {ticks.map((v) => (
            <span key={v} className="tabular">
              {formatNumber(v)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-36 w-full overflow-visible @3xl:h-44" aria-hidden>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.28" />
                <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} fill={`url(#${id})`} className="mk-path" style={{ d: `path("${area}")` } as React.CSSProperties} />
            <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2.25" vectorEffect="non-scaling-stroke" className="mk-path" style={{ d: `path("${line}")` } as React.CSSProperties} />
            {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="var(--ink-3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /> : null}
          </svg>
          {hover !== null ? (
            <>
              <span className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand shadow" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(values[hover]) / H) * 100}%` }} />
              <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg" style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%` }}>
                <p className="text-white/60">{days[hover].label}</p>
                <p className="tabular font-bold">{tab === "sales" ? formatMoney(values[hover]) : formatNumber(values[hover])}</p>
              </div>
            </>
          ) : null}
          <div className="mt-1 flex justify-between text-[10px] text-ink-3">
            <span>{days[0].label}</span>
            <span>{days[Math.floor(days.length / 2)].label}</span>
            <span>{days[days.length - 1].label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- orders ---------- */

function OrdersView({ orders, filter, onFilter, fresh, onConfirm, waiting }: { orders: DemoOrder[]; filter: Filter; onFilter: (f: Filter) => void; fresh: number[]; onConfirm: (n: number) => void; waiting: number }) {
  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const count = (f: Filter) => (f === "all" ? orders.length : orders.filter((o) => o.status === f).length);
  const [done, setDone] = React.useState<number | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold @3xl:text-2xl">{t.ordersTitle}</p>
          <p className="hidden text-xs text-ink-3 @2xl:block">{t.ordersSub}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onFilter("new")} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white">
            <PhoneCall className="size-3.5" aria-hidden />
            {t.queue(waiting)}
          </button>
          <span className="hidden h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold @xl:flex">
            <FileSpreadsheet className="size-3.5" aria-hidden />
            {t.export}
          </span>
        </div>
      </div>

      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => onFilter(f)} className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2 pt-1 text-[13px] transition-colors", filter === f ? "border-brand font-semibold text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
            {t.statuses[f]}
            <span className={cn("tabular rounded-full px-1.5 text-[11px] font-bold", filter === f ? "bg-primary text-white" : "bg-surface-2 text-ink-2")}>{count(f)}</span>
          </button>
        ))}
      </div>

      {done !== null ? (
        <p role="status" key={done} className="mk-toast flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-xs font-semibold text-success">
          <Check className="size-4" aria-hidden />
          {t.confirmed(done)}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="hidden grid-cols-[1fr_1.1fr_1.4fr_0.9fr_0.8fr_6.5rem] gap-3 border-b border-border bg-surface-2/60 px-4 py-2 text-[11px] font-semibold text-ink-3 @4xl:grid">
          <span>{t.columns.order}</span>
          <span>{t.columns.customer}</span>
          <span>{t.columns.items}</span>
          <span>{t.columns.delivery}</span>
          <span>{t.columns.total}</span>
          <span>{t.columns.status}</span>
        </div>
        {shown.length === 0 ? <p className="px-4 py-10 text-center text-sm text-ink-3">{t.empty}</p> : null}
        <ul className="divide-y divide-border">
          {shown.map((o) => (
            <li key={o.number} className={cn("grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px] @4xl:grid-cols-[1fr_1.1fr_1.4fr_0.9fr_0.8fr_6.5rem]", fresh.includes(o.number) && "mk-row-in")}>
              <div>
                <p className="flex items-center gap-1.5 font-bold">
                  #{o.number}
                  {o.duplicate ? (
                    <Badge size="sm" tone="attention">
                      {t.duplicate}
                    </Badge>
                  ) : null}
                </p>
                <p className="text-[11px] text-ink-3">{o.time}</p>
              </div>
              <div className="hidden @4xl:block">
                <p className="font-semibold">{o.name}</p>
                <p dir="ltr" className="tabular text-end text-[11px] text-ink-3">
                  {o.phone}
                </p>
              </div>
              <div className="col-span-2 row-start-2 @4xl:col-span-1 @4xl:row-start-auto">
                <p className="truncate">{o.items}</p>
                <p className="text-[11px]">
                  {o.source === "landing" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-info-soft px-1.5 text-info">
                      <Megaphone className="size-3" aria-hidden />
                      {t.fromLanding}
                    </span>
                  ) : (
                    <span className="text-ink-3">{t.fromStore}</span>
                  )}
                </p>
              </div>
              <div className="hidden @4xl:block">
                <p>{o.city}</p>
                <p className="text-[11px] text-ink-3">{o.carrier === "store" ? ar.marketing.journey.ship.options[0].name : ar.marketing.journey.ship.options[1].name}</p>
              </div>
              <p className="tabular hidden font-bold @4xl:block">{formatMoney(o.total)}</p>
              <div className="col-start-2 row-start-1 flex items-center justify-end gap-1.5 @4xl:col-start-auto @4xl:row-start-auto @4xl:justify-start">
                <Badge tone={TONES[o.status]} dot className="transition-colors duration-500">
                  {t.statuses[o.status]}
                </Badge>
                {o.status === "new" ? (
                  <button
                    type="button"
                    onClick={() => {
                      onConfirm(o.number);
                      setDone(o.number);
                    }}
                    className="rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-brand-soft"
                  >
                    {t.confirm}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
