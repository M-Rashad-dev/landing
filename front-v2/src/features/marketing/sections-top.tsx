import { Check, Gift, Menu, Search, ShoppingBag, Star } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import type * as React from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import bag from "../../../public/marketing/bag.jpg";
import beans from "../../../public/marketing/beans.jpg";
import glass from "../../../public/marketing/glass.jpg";
import grinder from "../../../public/marketing/grinder.jpg";
import latte from "../../../public/marketing/latte.jpg";
import { DashboardDemo } from "./dashboard-demo";
import { CountUp } from "./motion";

const m = ar.marketing;
export const PHOTOS: Record<string, StaticImageData> = { bag, beans, glass, grinder, latte };
export const delay = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

/** "01 / label" + a two-line title + a line of text, the head of every section. */
export function SectionHead({ num, label, title, sub, dark = false, className }: { num: string; label: string; title: readonly string[]; sub?: string; dark?: boolean; className?: string }) {
  return (
    <div className={cn("mb-12 grid grid-cols-1 gap-6 md:mb-16 lg:grid-cols-[200px_1fr] lg:gap-10", className)}>
      <p className={cn("mk-num w-40 lg:w-auto", dark ? "text-white" : "text-ink")} data-reveal="fade">
        <span className="tabular">{num}</span>
        <span>{label}</span>
      </p>
      <div>
        <h2 className={cn("mk-title", dark && "text-white")}>
          {title.map((line, i) => (
            <span key={line} data-reveal style={delay(i * 90)}>
              {line}
            </span>
          ))}
        </h2>
        {sub ? (
          <p className="mk-sub mt-5" data-reveal style={delay(200)}>
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- hero ---------- */

export function Hero({ registerUrl }: { registerUrl: string }) {
  const h = m.hero;
  return (
    <section id="top" className="pt-10 md:pt-16">
      <div className="mk-wrap">
        <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
          <div>
            <p className="mk-hero-line mb-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-semibold text-primary md:mb-8" style={delay(0)}>
              {h.eyebrow.map((e, i) => (
                <span key={e} className="flex items-center gap-2.5">
                  {i > 0 ? <span className="size-1 rounded-full bg-current opacity-50" aria-hidden /> : null}
                  {e}
                </span>
              ))}
            </p>
            <h1 className="mk-display font-semibold leading-[1.2] tracking-[-0.035em] text-[clamp(44px,8.2vw,108px)]">
              {h.lines.map((line, i) => (
                <span key={line} className={cn("mk-hero-line block", i === 2 && "text-primary")} style={delay(120 + i * 130)}>
                  {line}
                </span>
              ))}
            </h1>
          </div>
          <div className="lg:pb-4">
            <p className="mk-hero-line text-lg leading-[1.8] text-ink-2 md:text-[19px]" style={delay(520)}>
              {h.sub}
            </p>
            <form action={registerUrl} method="get" className="mk-hero-line mt-7 flex items-center gap-2 rounded-2xl border border-border bg-surface p-2 shadow-[0_16px_40px_-24px_rgb(var(--shadow-rgb)/0.45)] transition-shadow focus-within:shadow-[0_0_0_3px_var(--brand-soft),0_16px_40px_-24px_rgb(var(--shadow-rgb)/0.45)]" style={delay(640)}>
              <label htmlFor="mk-store" className="sr-only">
                {h.storePlaceholder}
              </label>
              <input id="mk-store" name="store" maxLength={100} placeholder={h.storePlaceholder} className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-ink-3" />
              <button type="submit" className="mk-btn mk-btn-mint h-11 px-5 text-[15px]">
                {h.cta}
              </button>
            </form>
            <p className="mk-hero-line mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-3" style={delay(740)}>
              {h.perks.map((p) => (
                <span key={p} className="flex items-center gap-1">
                  <Check className="size-3.5 text-primary" aria-hidden />
                  {p}
                </span>
              ))}
            </p>
          </div>
        </div>

        <div className="mk-tilt-in mt-14 md:mt-20">
          <div className="mk-tilt">
            <div className="mk-browser">
              <div className="mk-browser-bar">
                <i />
                <i />
                <i />
                <div className="mk-browser-url">app.maksab.com/dashboard</div>
              </div>
              <DashboardDemo live className="h-[660px] md:h-[680px] lg:h-[700px]" />
            </div>
          </div>
          <p className="mt-4 text-center text-[13px] text-ink-3">{h.demoHint}</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          {h.notes.map((note, i) => (
            <div key={note.title} className="border-t border-border pt-4" data-reveal style={delay(i * 100)}>
              <p className="font-semibold">{note.title}</p>
              <p className="mt-1 text-[15px] text-ink-2">{note.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- facts ---------- */

export function Facts() {
  return (
    <section className="mt-20 border-y border-border bg-[var(--mk-paper-2)] md:mt-28">
      <div className="mk-wrap grid grid-cols-2 md:grid-cols-5">
        {m.facts.map((f, i) => (
          <div key={f.title} className={cn("border-border py-6 md:py-8 md:ps-6", i % 2 === 1 ? "ps-4" : "", "md:border-s md:first:border-s-0", i === 4 && "col-span-2 md:col-span-1")} data-reveal style={delay(i * 70)}>
            <p className="mk-display text-2xl font-semibold md:text-[28px]" dir={"ltr" in f ? "ltr" : undefined} style={"ltr" in f ? { textAlign: "right" } : undefined}>
              {f.title}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-3">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- 01 the journey ---------- */

function JourneyCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("relative h-[330px] overflow-hidden rounded-2xl bg-surface text-[12px] text-ink", className)}>{children}</div>;
}

export function Journey() {
  const j = m.journey;
  const cards: React.ReactNode[] = [
    <JourneyCard key="ad">
      <div className="flex items-center gap-2 p-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-[var(--mk-coffee)] text-xs font-bold text-[#f6e7d2]">ح</span>
        <div>
          <p className="font-bold">{j.ad.page}</p>
          <p className="text-[10px] text-ink-3">{j.ad.sponsored}</p>
        </div>
      </div>
      <p className="px-3 pb-2 leading-relaxed">{j.ad.text}</p>
      <div className="relative h-[150px]">
        <Image src={grinder} alt="" fill sizes="240px" className="object-cover" />
      </div>
      <div className="flex items-center justify-between bg-[#f2f4f1] px-3 py-2.5">
        <span dir="ltr" className="text-[10px] text-ink-3">
          HABBA.COM
        </span>
        <span className="rounded-md bg-[#e4e6eb] px-2.5 py-1 font-bold">{j.ad.cta}</span>
      </div>
    </JourneyCard>,
    <JourneyCard key="landing" className="bg-[var(--mk-cream)] text-[#2a1a10]">
      <p className="bg-[var(--mk-coffee)] py-1.5 text-center text-[10px] text-[#f6e7d2]">{j.landing.ribbon}</p>
      <div className="relative h-[110px]">
        <Image src={grinder} alt="" fill sizes="240px" className="object-cover" />
      </div>
      <div className="p-2.5">
        <p className="mk-display text-sm font-bold">{j.landing.name}</p>
        <p className="mb-2 mt-0.5">
          <b className="text-[15px] text-[var(--mk-coffee-2)]">{formatMoney(1450)}</b> <s className="text-[#a08e80]">1,800</s>
        </p>
        <div className="grid gap-1.5">
          {j.landing.fields.map((f) => (
            <div key={f} className="h-[26px] rounded-md border border-[#e8ddcf] bg-white px-2 py-1 text-[#a08e80]">
              {f}
            </div>
          ))}
        </div>
        <div className="mk-coffee-btn mt-2 h-8 text-[11px]">{j.landing.cta}</div>
      </div>
    </JourneyCard>,
    <JourneyCard key="upsell" className="bg-[var(--mk-cream)] p-3 text-[#2a1a10]">
      <div className="py-1.5 text-center">
        <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-brand-soft text-primary">
          <Check className="size-5" aria-hidden />
        </span>
        <p className="mk-display mt-1.5 text-sm font-bold">
          {j.upsell.done} <span dir="ltr">#1034</span>
        </p>
      </div>
      <div className="mt-2 rounded-xl border-2 border-dashed border-[var(--mk-coffee-2)] p-2.5">
        <p className="flex items-center gap-1 text-[11px] font-bold text-[var(--mk-coffee-2)]">
          <Gift className="size-3.5" aria-hidden />
          {j.upsell.offer}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Image src={bag} alt="" width={52} height={52} className="size-[52px] rounded-lg object-cover" />
          <div>
            <p className="font-bold">{j.upsell.product}</p>
            <p>
              <b className="text-[var(--mk-coffee-2)]">{formatMoney(199)}</b> <s className="text-[#a08e80]">320</s>
            </p>
          </div>
        </div>
        <div className="mk-coffee-btn mt-2.5 h-8">{j.upsell.add}</div>
        <p className="mt-1.5 text-center text-[11px] text-[#a08e80]">{j.upsell.skip}</p>
      </div>
    </JourneyCard>,
    <JourneyCard key="confirm" className="p-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold">{j.confirm.title}</p>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent-ink">{j.confirm.waiting}</span>
      </div>
      <div className="mt-2.5 rounded-xl border border-border p-2.5">
        <div className="flex justify-between">
          <b>{j.confirm.name}</b>
          <span dir="ltr" className="text-ink-3">
            010 2345 6789
          </span>
        </div>
        <p className="text-ink-3">{j.confirm.area}</p>
        <p className="mt-1.5">{j.confirm.items}</p>
        <p className="mk-display mt-0.5 font-semibold">{formatMoney(1649)}</p>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <span className="flex h-[30px] items-center justify-center rounded-lg bg-primary font-semibold text-white">{j.confirm.yes}</span>
          <span className="flex h-[30px] items-center justify-center rounded-lg border border-border">{j.confirm.noAnswer}</span>
        </div>
        <span className="mt-1.5 flex h-[30px] items-center justify-center rounded-lg bg-[#25d366] font-semibold text-white">{j.confirm.whatsapp}</span>
      </div>
      <p className="mt-2 text-[11px] text-ink-3">{j.confirm.attempts}</p>
    </JourneyCard>,
    <JourneyCard key="ship" className="p-3">
      <p className="text-[13px] font-bold">{j.ship.title}</p>
      <div className="mt-2.5 grid gap-1.5">
        {j.ship.options.map((o, i) => (
          <div key={o.name} className={cn("flex justify-between rounded-xl border px-2.5 py-2", i === 0 ? "border-brand bg-brand-soft" : "border-border")}>
            <span>
              <b>{o.name}</b>
              <br />
              <span className="text-ink-3">{o.area}</span>
            </span>
            <b>{formatMoney(o.price)}</b>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 border-t border-border pt-2.5">
        {j.ship.timeline.map((s, i) => (
          <div key={s.status} className="flex items-center gap-1.5">
            <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold", i === 0 ? "bg-info-soft text-info" : i === 1 ? "bg-brand-soft text-primary" : "bg-primary text-white")}>
              <span className="size-1.5 rounded-full bg-current" />
              {s.status}
            </span>
            <span className="min-w-0 truncate text-ink-3">{s.note}</span>
          </div>
        ))}
      </div>
    </JourneyCard>,
    <JourneyCard key="sheet">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="h-[22px] w-[18px] rounded-sm bg-[#0f9d58]" aria-hidden />
        <b>{j.sheet.title}</b>
      </div>
      <table className="w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="bg-[#f1f3f4] text-[#5f6368]">
            {j.sheet.head.map((h) => (
              <th key={h} className="border border-[#e3e5e8] px-1.5 py-1 text-start font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {j.sheet.rows.map((row, i) => (
            <tr key={row[0]} className={i === 0 ? "bg-[#e6f4ea]" : undefined}>
              {row.map((cell, k) => (
                <td key={k} className="border border-[#e3e5e8] px-1.5 py-1.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p dir="ltr" className="m-3 rounded-lg bg-[#f5f3ff] p-2.5 text-left font-mono text-[11px] leading-relaxed text-[#5b3fc4]">
        POST /your-system
        <br />
        event: order.created
        <br />
        signature: sha256=…
      </p>
    </JourneyCard>,
  ];

  return (
    <section className="mk-dark bg-[var(--mk-deep)] py-24 text-white md:py-32">
      <div className="mk-wrap">
        <SectionHead num={j.num} label={j.label} title={j.title} sub={j.sub} dark />
        <div className="relative" data-reveal="fade">
          <div className="mk-draw absolute inset-x-5 top-5 hidden h-0.5 bg-[repeating-linear-gradient(to_left,var(--mk-deep-line)_0_8px,transparent_8px_14px)] lg:block" aria-hidden />
          <ol className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0">
            {j.steps.map((step, i) => (
              <li key={step.title} className="w-[260px] shrink-0 snap-start lg:w-auto" data-reveal style={delay(250 + i * 120)}>
                <span className="relative flex size-10 items-center justify-center rounded-full border-2 border-brand bg-[var(--mk-deep)] text-sm font-bold text-brand">{i + 1}</span>
                <p className="mt-4 text-[17px] font-semibold">{step.title}</p>
                <p className="mb-6 text-[13px] text-[#8fa699]">{step.text}</p>
                {cards[i]}
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-14 grid grid-cols-2 overflow-hidden rounded-2xl border border-[var(--mk-deep-line)] sm:grid-cols-5" data-reveal>
          {j.funnel.map((f, i) => (
            <div key={f.label} className={cn("border-[var(--mk-deep-line)] px-5 py-5 sm:border-s sm:first:border-s-0 md:px-6", i === j.funnel.length - 1 && "col-span-2 bg-[var(--mk-deep-2)] sm:col-span-1", i < 4 && "border-b sm:border-b-0", i % 2 === 1 && "border-s")}>
              <p className="text-[13px] text-[#8fa699]">{f.label}</p>
              <p className={cn("mk-display text-3xl font-semibold md:text-[34px]", i === j.funnel.length - 1 && "text-brand")}>
                <CountUp value={f.value} decimals={f.value % 1 ? 1 : 0} suffix="%" />
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-[#6e8778]">{j.funnelNote}</p>
      </div>
    </section>
  );
}

/* ---------- 02 the store ---------- */

function StoreTop({ title }: { title?: string }) {
  return (
    <div className="flex items-center justify-between px-4 pb-2.5 pt-10 text-[var(--mk-coffee)]">
      {title ? (
        <p className="mk-display mx-auto text-[15px] font-bold">{title}</p>
      ) : (
        <>
          <Menu className="size-[18px]" aria-hidden />
          <span className="mk-display text-xl font-bold">{m.store.name}</span>
          <ShoppingBag className="size-[18px]" aria-hidden />
        </>
      )}
    </div>
  );
}

export function StoreSection() {
  const s = m.store;
  const c = s.checkout;
  const total = c.rows.reduce((sum, r) => sum + r.value, 0);
  return (
    <section id="store" className="py-24 md:py-32">
      <div className="mk-wrap">
        <SectionHead num={s.num} label={s.label} title={s.title} sub={s.sub} />
        <div className="relative overflow-hidden rounded-[28px] bg-[var(--mk-paper-2)] px-4 pt-12 md:px-10 lg:h-[640px] lg:pt-16" data-reveal="scale">
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory items-end gap-6 overflow-x-auto px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:justify-items-center lg:gap-0 lg:overflow-visible lg:px-0">
            {/* home */}
            <div className="mk-phone mk-float snap-center lg:-mb-10 text-[12px] text-[#2a1a10]">
              <div>
                <StoreTop />
                <div className="relative mx-3 mt-1 h-[200px] overflow-hidden rounded-[18px]">
                  <Image src={latte} alt="" fill sizes="280px" className="object-cover" />
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[rgb(30_15_5/0.78)] to-transparent to-60% p-4 text-white">
                    <p className="mk-display text-xl font-bold leading-snug">
                      {s.hero[0]}
                      <br />
                      {s.hero[1]}
                    </p>
                    <span className="mt-2 self-start rounded-lg bg-[#f6e7d2] px-3 py-1.5 font-bold text-[var(--mk-coffee)]">{s.shop}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 p-3">
                  {s.chips.map((chip, i) => (
                    <span key={chip} className={cn("rounded-full px-2.5 py-1 font-semibold", i === 0 ? "bg-[var(--mk-coffee)] text-white" : "bg-[#f1e9de]")}>
                      {chip}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 px-3">
                  {s.products.slice(0, 2).map((p) => (
                    <div key={p.name} className="overflow-hidden rounded-[14px] border border-[#efe6da] bg-white">
                      <div className="relative h-[110px]">
                        <Image src={PHOTOS[p.image]} alt="" fill sizes="140px" className="object-cover" />
                      </div>
                      <div className="p-2">
                        <p className="font-bold">{p.name}</p>
                        <p className="font-bold text-[var(--mk-coffee-2)]">{formatMoney(p.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* product */}
            <div className="mk-phone mk-float-2 snap-center text-[12px] text-[#2a1a10]">
              <div>
                <div className="relative h-[290px]">
                  <Image src={bag} alt="" fill sizes="280px" className="object-cover" />
                </div>
                <div className="p-4">
                  <p className="flex items-center gap-1 text-[#e0a53b]">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className="size-3.5 fill-current" aria-hidden />
                    ))}
                    <span className="text-[#a08e80]">{s.product.reviews}</span>
                  </p>
                  <p className="mk-display mt-1 text-lg font-bold">{s.product.name}</p>
                  <p className="mt-1 flex items-center gap-2">
                    <b className="text-lg text-[var(--mk-coffee-2)]">{formatMoney(320)}</b>
                    <span className="rounded-full bg-[#fde8d8] px-2 py-0.5 text-[11px] font-semibold text-[#b0501a]">{s.product.offer}</span>
                  </p>
                  <p className="mt-3 font-semibold">{s.product.grind}</p>
                  <div className="mt-1.5 flex gap-1.5">
                    {s.product.grinds.map((g, i) => (
                      <span key={g} className={cn("rounded-full px-3 py-1.5", i === 0 ? "bg-[var(--mk-coffee)] text-white" : "border border-[#e8ddcf]")}>
                        {g}
                      </span>
                    ))}
                  </div>
                  <div className="mk-coffee-btn mt-4 h-10 text-[13px]">{s.product.add}</div>
                </div>
              </div>
            </div>
            {/* checkout */}
            <div className="mk-phone mk-float snap-center lg:-mb-10 text-[12px] text-[#2a1a10]">
              <div>
                <StoreTop title={c.title} />
                <div className="grid gap-2 px-3.5">
                  <div className="flex items-center gap-2 rounded-xl border border-[#efe6da] bg-white p-2">
                    <Image src={bag} alt="" width={44} height={44} className="size-11 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="font-bold">{c.line}</p>
                      <p className="text-[#a08e80]">{c.variant}</p>
                    </div>
                    <b className="text-[var(--mk-coffee-2)]">{formatMoney(960)}</b>
                  </div>
                  <p className="mt-1 font-semibold">{c.shipTo}</p>
                  <div className="flex justify-between rounded-xl border-2 border-[var(--mk-coffee)] bg-white p-2.5">
                    <span>{c.carrier}</span>
                    <b>{formatMoney(65)}</b>
                  </div>
                  <div className="flex justify-between rounded-xl border border-dashed border-[#c9b8a6] p-2.5 text-[var(--mk-coffee-2)]">
                    <span dir="ltr">{c.code}</span>
                    <b>{formatMoney(-64)}</b>
                  </div>
                  <div className="grid gap-0.5 border-t border-[#efe6da] pt-2">
                    {c.rows.map((r) => (
                      <p key={r.label} className="flex justify-between text-[#7d6b5d]">
                        <span>{r.label}</span>
                        <span className="tabular">{formatMoney(r.value, { withCurrency: false })}</span>
                      </p>
                    ))}
                    <p className="flex justify-between text-[15px] font-bold">
                      <span>{c.total}</span>
                      <span>{formatMoney(total)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-[#f1e9de] p-2.5">
                    <span className="size-4 rounded-full border-[5px] border-[var(--mk-coffee)]" />
                    <b>{c.cod}</b>
                  </div>
                  <div className="mk-coffee-btn h-10 text-[13px]">{c.confirm}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Features items={s.features} className="md:grid-cols-2 lg:grid-cols-4" />
      </div>
    </section>
  );
}

export function Features({ items, className }: { items: ReadonlyArray<{ title: string; text: string }>; className?: string }) {
  return (
    <div className={cn("mt-12 grid grid-cols-1 gap-8 md:gap-10", className)}>
      {items.map((f, i) => (
        <div key={f.title} className="border-t border-border pt-4" data-reveal style={delay(i * 90)}>
          <p className="text-[17px] font-semibold">{f.title}</p>
          <p className="mt-1 text-[15px] text-ink-2">{f.text}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- 03 the builder ---------- */

export function BuilderSection() {
  const b = m.builder;
  return (
    <section className="pb-24 md:pb-32">
      <div className="mk-wrap grid grid-cols-1 items-center gap-12 lg:grid-cols-[340px_1fr] lg:gap-14">
        <div>
          <p className="mk-num w-40" data-reveal="fade">
            <span className="tabular">{b.num}</span>
            <span>{b.label}</span>
          </p>
          <h2 className="mk-title mt-8 !text-[clamp(32px,4vw,48px)]">
            {b.title.map((line, i) => (
              <span key={line} data-reveal style={delay(i * 90)}>
                {line}
              </span>
            ))}
          </h2>
          <p className="mk-sub mt-4" data-reveal style={delay(180)}>
            {b.sub}
          </p>
          <ul className="mt-7 grid gap-3 text-[15px]">
            {b.points.map((p, i) => (
              <li key={p} className="flex items-center gap-2.5" data-reveal style={delay(260 + i * 80)}>
                <span className="flex size-6 items-center justify-center rounded-full bg-brand-soft text-primary">
                  <Check className="size-3.5" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="mk-browser" data-reveal="scale">
          <div className="mk-browser-bar">
            <i />
            <i />
            <i />
            <div className="mk-browser-url">app.maksab.com/dashboard/design/builder</div>
          </div>
          <div className="flex h-[52px] items-center gap-2.5 border-b border-border px-3.5 text-[13px]">
            <div>
              <b>{m.store.name}</b>
              <p className="text-[11px] leading-none text-ink-3">{b.theme}</p>
            </div>
            <span className="ms-auto hidden items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-primary sm:flex">
              <Check className="size-3.5" aria-hidden />
              {b.saved}
            </span>
            <span className="ms-auto rounded-lg border border-border px-2.5 py-1 sm:ms-0">{b.preview}</span>
            <span className="rounded-lg bg-primary px-3 py-1 font-semibold text-white">{b.publish}</span>
          </div>
          <div className="flex min-h-[470px]">
            <div className="hidden w-[230px] shrink-0 border-e border-border p-3.5 text-[12px] md:block">
              <b className="text-sm">{b.page}</b>
              <p className="mb-2.5 text-[11px] text-ink-3">{b.drag}</p>
              {b.sections.map((name, i) => {
                const fixed = i === 0 || i === b.sections.length - 1;
                const active = i === 1;
                const hidden = i === 4;
                return (
                  <div key={name} className={cn("mt-1.5 flex items-center gap-2 rounded-[10px] border px-2.5 py-[7px] text-ink-3 transition-colors", active ? "border-brand bg-brand-soft shadow-[0_0_0_1px_var(--brand)]" : fixed ? "border-border bg-surface-2" : "border-border hover:border-border-strong", hidden && "opacity-55")}>
                    <span aria-hidden>{fixed ? "▤" : "⋮⋮"}</span>
                    <span className="flex-1 font-semibold text-ink">{name}</span>
                    <span className="text-[10px]">{fixed ? b.fixed : hidden ? b.hidden : active ? "●" : "…"}</span>
                  </div>
                );
              })}
              <div className="mt-2 flex h-[34px] items-center justify-center rounded-[10px] border border-dashed border-border-strong text-ink-2">+ {b.add}</div>
              <div className="mt-3.5 border-t border-border pt-3">
                <b>{b.sections[1]}</b>
                <p className="mt-2 text-ink-3">{b.field}</p>
                <div className="mt-1 rounded-lg border border-border px-2 py-1.5">
                  {m.store.hero[0]} {m.store.hero[1]}
                </div>
                <p className="mt-2 text-ink-3">{b.color}</p>
                <div className="mt-1.5 flex gap-1.5">
                  {["var(--mk-coffee)", "#f6e7d2", "#c2410c", "#0b875b"].map((color, i) => (
                    <span key={color} className={cn("size-5 rounded-full", i === 0 && "ring-2 ring-ink ring-offset-2")} style={{ background: color }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-1 bg-[#eef2ec] p-3 md:p-4">
              <div className="overflow-hidden rounded-[10px] bg-[var(--mk-cream)] text-[11px] text-[#2a1a10] shadow-[0_10px_30px_-14px_rgb(0_0_0/0.25)]">
                <p className="bg-[var(--mk-coffee)] py-1 text-center text-[10px] text-[#f6e7d2]">{b.announcement}</p>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="mk-display text-[17px] font-bold text-[var(--mk-coffee)]">{m.store.name}</span>
                  <span className="hidden gap-4 text-[#7d6b5d] sm:flex">
                    {b.nav.map((n) => (
                      <span key={n}>{n}</span>
                    ))}
                  </span>
                  <span className="flex gap-3 text-[var(--mk-coffee)]">
                    <Search className="size-4" aria-hidden />
                    <ShoppingBag className="size-4" aria-hidden />
                  </span>
                </div>
                <div className="relative mx-3 rounded-xl outline outline-2 outline-offset-[3px] outline-brand">
                  <span className="absolute -top-3.5 end-2.5 z-10 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-ink">{b.sections[1]}</span>
                  <div className="relative h-[170px] overflow-hidden rounded-xl md:h-[190px]">
                    <Image src={latte} alt="" fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
                    <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-l from-[rgb(30_15_5/0.82)] to-transparent to-70% p-5 text-white">
                      <p className="mk-display text-xl font-bold leading-snug md:text-2xl">
                        {m.store.hero[0]}
                        <br />
                        {m.store.hero[1]}
                      </p>
                      <span className="mt-2.5 self-start rounded-lg bg-[#f6e7d2] px-3 py-1.5 font-bold text-[var(--mk-coffee)]">{m.store.shop}</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between px-3 pb-1 pt-3.5">
                  <b className="mk-display text-sm">{b.latest}</b>
                  <span className="text-[var(--mk-coffee-2)]">{b.all}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 px-3 pb-3.5 sm:grid-cols-4">
                  {m.store.products.map((p) => (
                    <div key={p.name} className="mk-zoom overflow-hidden rounded-xl border border-[#efe6da] bg-white">
                      <div className="relative h-[84px] overflow-hidden">
                        <Image src={PHOTOS[p.image]} alt="" fill sizes="150px" className="object-cover" />
                      </div>
                      <div className="p-1.5">
                        <b>{p.name}</b>
                        <p className="font-bold text-[var(--mk-coffee-2)]">{formatMoney(p.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
