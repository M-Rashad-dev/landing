import Image from "next/image";
import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/config/brand";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import cups from "../../../public/marketing/cups.jpg";
import grinder from "../../../public/marketing/grinder.jpg";
import { DashboardDemo } from "./dashboard-demo";
import { Faq } from "./faq";
import { SECTIONS } from "./nav";
import type { PlatformPageLink } from "./pages";
import type { PricingData } from "./plans";
import { Pricing } from "./pricing";
import { delay, Features, SectionHead } from "./sections-top";

const m = ar.marketing;

/* ---------- 04 landing pages + A/B ---------- */

function TestPhone({ side }: { side: "a" | "b" }) {
  const l = m.landing;
  const a = side === "a";
  return (
    <div className={cn("w-[260px] shrink-0 snap-center sm:w-[280px] lg:w-auto", !a && "lg:order-last")} data-reveal style={delay(a ? 0 : 180)}>
      <div className="mb-3.5 flex items-center justify-between">
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", a ? "bg-info-soft text-info" : "bg-accent-soft text-accent-ink")}>{a ? l.a.tag : l.b.tag}</span>
        <span className="text-[13px] text-ink-3">{l.split}</span>
      </div>
      <div className={cn("mk-phone !aspect-[300/540] text-[12px] text-[#2a1a10]", !a && "shadow-[0_0_0_4px_var(--brand),0_40px_80px_-30px_rgb(var(--shadow-rgb)/0.5)]")}>
        {a ? (
          <div>
            <p className="mk-display px-4 pt-11 text-center text-[19px] font-bold leading-snug">
              {l.a.title[0]}
              <br />
              {l.a.title[1]}
            </p>
            <div className="relative mx-4 mt-3 h-[190px] overflow-hidden rounded-[14px]">
              <Image src={grinder} alt="" fill sizes="260px" className="object-cover" />
            </div>
            <div className="px-4 pt-3">
              <b className="text-xl text-[var(--mk-coffee-2)]">{formatMoney(1450)}</b>
              <p className="mt-1 text-[#7d6b5d]">{l.a.points}</p>
              <div className="mk-coffee-btn mt-3.5 h-10 text-[13px]">{l.a.cta}</div>
            </div>
          </div>
        ) : (
          <div>
            <div className="relative h-[250px]">
              <Image src={cups} alt="" fill sizes="280px" className="object-cover" />
            </div>
            <div className="px-4 pt-3.5">
              <p className="mk-display text-[19px] font-bold leading-snug">
                {l.b.title[0]}
                <br />
                {l.b.title[1]}
              </p>
              <p className="mt-1.5">
                <b className="text-xl text-[var(--mk-coffee-2)]">{formatMoney(1450)}</b> <s className="text-[#a08e80]">1,800</s>
              </p>
              <p className="mt-1 text-[#7d6b5d]">{l.b.social}</p>
              <div className="mk-coffee-btn mt-3.5 h-10 text-[13px]">{l.b.cta}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function LandingSection() {
  const l = m.landing;
  return (
    <section id="landing" className="border-y border-border bg-surface py-24 md:py-32">
      <div className="mk-wrap">
        <SectionHead num={l.num} label={l.label} title={l.title} sub={l.sub} />
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[280px_1fr_280px] lg:gap-14">
          <div className="order-last -mx-4 flex snap-x snap-mandatory justify-start gap-6 overflow-x-auto px-6 pb-2 sm:justify-center lg:contents">
            <TestPhone side="a" />
            <TestPhone side="b" />
          </div>
          <div data-reveal="scale" style={delay(100)}>
            <div className="rounded-[20px] border border-border bg-[var(--mk-paper)] p-5 md:p-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="mk-display text-lg font-semibold md:text-xl">{l.test}</p>
                <span className="flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-primary">
                  <span className="size-1.5 animate-pulse rounded-full bg-current" />
                  {l.running}
                </span>
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[420px] text-[15px]">
                  <thead>
                    <tr className="text-[13px] text-ink-3">
                      <th className="pb-2.5" />
                      {l.columns.map((c) => (
                        <th key={c} className="pb-2.5 text-start font-normal">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {l.rows.map((row) => {
                      const b = row.side === "B";
                      return (
                        <tr key={row.side} className={cn("border-t border-border", b && "bg-brand-soft")}>
                          <td className="px-1.5 py-3.5">
                            <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold", b ? "bg-accent-soft text-accent-ink" : "bg-info-soft text-info")}>{row.side}</span>
                          </td>
                          <td className="tabular">{formatNumber(row.views)}</td>
                          <td className="tabular">{formatNumber(row.orders)}</td>
                          <td className={cn("tabular", b && "font-bold text-primary")}>
                            {row.conversion}%{b ? <span className="ms-1 text-xs">({l.lift})</span> : null}
                          </td>
                          <td className="tabular">{formatNumber(row.revenue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[#e3e9e1]">
                <div className="mk-fill h-full rounded-full bg-primary" style={{ width: `${l.confidence}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-1 text-sm">
                <b className="text-primary">{l.verdict(l.confidence)}</b>
                <span className="text-ink-3">{l.rule}</span>
              </div>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <span className="mk-btn mk-btn-ink h-11 px-4 text-sm">{l.keepB}</span>
                <span className="mk-btn mk-btn-line h-11 px-4 text-sm">{l.keepA}</span>
              </div>
            </div>
            <p className="mt-3 text-center text-[13px] text-ink-3">{l.illustrative}</p>
          </div>
        </div>
        <Features items={l.features} className="md:grid-cols-3" />
      </div>
    </section>
  );
}

/* ---------- 05 orders (the live demo again, on the orders screen) ---------- */

export function OrdersSection() {
  const o = m.orders;
  return (
    <section id="orders" className="py-24 md:py-32">
      <div className="mk-wrap">
        <SectionHead num={o.num} label={o.label} title={o.title} sub={o.sub} />
        <div className="mk-browser" data-reveal="scale">
          <div className="mk-browser-bar">
            <i />
            <i />
            <i />
            <div className="mk-browser-url">app.maksab.com/dashboard/orders</div>
          </div>
          <DashboardDemo initialView="orders" className="h-[640px] md:h-[620px]" />
        </div>
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {o.notes.map((n, i) => (
            <div key={n.title} className="flex gap-3" data-reveal style={delay(i * 90)}>
              <span className="mk-note-n">{i + 1}</span>
              <div>
                <p className="font-semibold">{n.title}</p>
                <p className="mt-0.5 text-[15px] text-ink-2">{n.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 06 tools ---------- */

export function ToolsSection() {
  const t = m.tools;
  return (
    <section className="pb-24 md:pb-32">
      <div className="mk-wrap">
        <SectionHead num={t.num} label={t.label} title={t.title} className="!mb-10" />
        <div className="grid grid-cols-1 border-t-2 border-ink sm:grid-cols-2 lg:grid-cols-4">
          {t.groups.map((g, i) => (
            <div key={g.title} className={cn("pt-6 sm:pe-6", i > 0 && "lg:border-s lg:border-border lg:ps-6", i % 2 === 1 && "sm:border-s sm:border-border sm:ps-6 lg:ps-6")} data-reveal style={delay(i * 100)}>
              <h3 className="mb-3 text-sm font-semibold text-primary">{g.title}</h3>
              <ul>
                {g.items.map((item) => (
                  <li key={item} className="border-b border-border py-3 text-base">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 07 pricing ---------- */

export function PricingSection({ data, registerUrl }: { data: PricingData | null; registerUrl: string }) {
  const p = m.pricing;
  return (
    <section id="pricing" className="border-t border-border bg-[var(--mk-paper-2)] py-24 md:py-32">
      <div className="mk-wrap">
        <SectionHead num={p.num} label={p.label} title={[p.title]} sub={p.sub} className="!mb-10" />
        {data && data.plans.length > 0 ? <Pricing plans={data.plans} registerUrl={registerUrl} /> : <p className="rounded-2xl border border-border bg-surface p-8 text-center text-ink-2">{p.unavailable}</p>}
      </div>
    </section>
  );
}

/* ---------- 08 FAQ ---------- */

export function FaqSection({ whatsapp }: { whatsapp: string | null }) {
  const f = m.faq;
  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="mk-wrap grid grid-cols-1 gap-10 lg:grid-cols-[360px_1fr] lg:gap-20">
        <div>
          <p className="mk-num w-40" data-reveal="fade">
            <span className="tabular">{f.num}</span>
            <span>{f.label}</span>
          </p>
          <h2 className="mk-title mt-8 !text-[clamp(34px,4vw,48px)]" data-reveal>
            {f.title}
          </h2>
          {whatsapp ? (
            <p className="mt-3 text-ink-2" data-reveal style={delay(120)}>
              {f.ask}{" "}
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mk-link font-semibold text-primary">
                {f.whatsapp} ←
              </a>
            </p>
          ) : null}
        </div>
        <div className="border-b border-border">
          <Faq />
        </div>
      </div>
    </section>
  );
}

/* ---------- closing ---------- */

export function ClosingCta({ registerUrl }: { registerUrl: string }) {
  const c = m.cta;
  return (
    <section className="mk-wrap pb-24">
      <div className="relative grid grid-cols-1 items-end gap-10 overflow-hidden rounded-[32px] bg-brand px-6 py-14 md:px-16 md:py-20 lg:grid-cols-[1fr_420px]" data-reveal="scale">
        <svg viewBox="0 0 400 400" className="pointer-events-none absolute -top-36 left-10 hidden w-[300px] opacity-[0.16] lg:block" aria-hidden>
          <rect x="40" y="220" width="70" height="120" rx="12" fill="#0d1b14" />
          <rect x="160" y="150" width="70" height="190" rx="12" fill="#0d1b14" />
          <rect x="280" y="60" width="70" height="280" rx="12" fill="#0d1b14" />
        </svg>
        <h2 className="mk-display relative text-[clamp(44px,7vw,88px)] font-semibold leading-[1.12] tracking-[-0.035em] text-ink">
          {c.title.map((line, i) => (
            <span key={line} className="block" data-reveal style={delay(150 + i * 110)}>
              {line}
            </span>
          ))}
        </h2>
        <div className="relative">
          <form action={registerUrl} method="get" className="flex items-center gap-2 rounded-2xl bg-white p-2">
            <label htmlFor="mk-store-2" className="sr-only">
              {m.hero.storePlaceholder}
            </label>
            <input id="mk-store-2" name="store" maxLength={100} placeholder={m.hero.storePlaceholder} className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-ink-3" />
            <button type="submit" className="mk-btn mk-btn-ink h-11 px-5 text-[15px]">
              {m.hero.cta}
            </button>
          </form>
          <p className="mt-3.5 text-sm text-[#0e3a27]">{c.note}</p>
        </div>
      </div>
    </section>
  );
}

export function MarketingFooter({ loginUrl, registerUrl, support, pages, home = "" }: { loginUrl: string; registerUrl: string; support: PricingData["support"] | null; pages: PlatformPageLink[]; home?: string }) {
  const f = m.footer;
  return (
    <footer className="bg-[var(--mk-deep)] pb-10 pt-20 text-[#a9bdb1]">
      <div className="mk-wrap">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div>
            <span className="[&_span]:!text-white">
              <Logo />
            </span>
            <p className="mt-4 max-w-72 text-sm">{f.about}</p>
          </div>
          <div>
            <p className="mb-3.5 text-sm font-semibold text-white">{f.product}</p>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`${home}#${s.id}`} className="block py-1.5 text-sm hover:text-white">
                {s.label}
              </a>
            ))}
          </div>
          <div>
            <p className="mb-3.5 text-sm font-semibold text-white">{f.account}</p>
            <a href={registerUrl} className="block py-1.5 text-sm hover:text-white">
              {m.nav.start}
            </a>
            <a href={loginUrl} className="block py-1.5 text-sm hover:text-white">
              {m.nav.login}
            </a>
          </div>
          {pages.length > 0 ? (
            <div>
              <p className="mb-3.5 text-sm font-semibold text-white">{f.legal}</p>
              {pages.map((p) => (
                <a key={p.slug} href={`/${p.slug}`} className="block py-1.5 text-sm hover:text-white">
                  {p.title}
                </a>
              ))}
            </div>
          ) : null}
          {support && (support.whatsapp || support.email) ? (
            <div>
              <p className="mb-3.5 text-sm font-semibold text-white">{f.contact}</p>
              {support.whatsapp ? (
                <p dir="ltr" className="py-1.5 text-end text-sm">
                  {support.whatsapp}
                </p>
              ) : null}
              {support.email ? (
                <a href={`mailto:${support.email}`} dir="ltr" className="block py-1.5 text-end text-sm hover:text-white">
                  {support.email}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="mt-16 flex flex-wrap justify-between gap-2 border-t border-[var(--mk-deep-line)] pt-6 text-[13px]">
          <span>{f.rights(new Date().getFullYear(), BRAND.name)}</span>
        </div>
      </div>
    </footer>
  );
}
