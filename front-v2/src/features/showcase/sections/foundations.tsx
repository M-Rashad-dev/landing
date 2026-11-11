import { formatDateTime, formatMoney, formatNumber, formatPercent, formatPhone } from "@/lib/format";
import { ar } from "@/messages/ar";
import { ShowSection, Specimen } from "../frame";

const t = ar.showcase.foundations;

const COLORS: Array<{ token: string; role: keyof typeof t.roles; dark?: boolean }> = [
  { token: "--ink", role: "ink", dark: true },
  { token: "--brand", role: "brand", dark: true },
  { token: "--brand-strong", role: "brandStrong", dark: true },
  { token: "--accent", role: "accent" },
  { token: "--bg", role: "bg" },
  { token: "--surface", role: "surface" },
  { token: "--surface-2", role: "surface2" },
  { token: "--border", role: "border" },
  { token: "--success", role: "success", dark: true },
  { token: "--warning", role: "warning", dark: true },
  { token: "--danger", role: "danger", dark: true },
  { token: "--info", role: "info", dark: true },
];

export function FoundationsSection() {
  return (
    <ShowSection id="foundations" title={ar.showcase.sections.foundations.title} description={ar.showcase.sections.foundations.description}>
      <Specimen label={t.colors}>
        <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {COLORS.map((c) => (
            <li key={c.token} className="overflow-hidden rounded-lg border border-border">
              <div className="flex h-16 items-end p-2 text-[11px] font-semibold" style={{ background: `var(${c.token})`, color: c.dark ? "#fff" : "var(--ink)" }}>
                <span dir="ltr">{c.token}</span>
              </div>
              <p className="px-2 py-1.5 text-xs text-ink-2">{t.roles[c.role]}</p>
            </li>
          ))}
        </ul>
      </Specimen>
      <Specimen label={t.type} stack>
        <p className="text-xs text-ink-3">{t.fonts}</p>
        <h1 className="text-2xl font-bold">{t.typeSamples.h1} · 24</h1>
        <h2 className="text-xl font-bold">{t.typeSamples.h2} · 20</h2>
        <h3 className="text-[15px] font-semibold">{t.typeSamples.h3} · 15</h3>
        <p>{t.typeSamples.body}</p>
        <p className="text-xs text-ink-3">{t.typeSamples.small}</p>
        <p className="tabular font-display text-[26px] font-semibold">{t.typeSamples.number} 1,240 · 48,500</p>
      </Specimen>
      <Specimen label={t.radius}>
        {["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-full"].map((r) => (
          <div key={r} className={`flex size-16 items-center justify-center border border-border-strong bg-surface-2 text-[10px] text-ink-3 ${r}`} dir="ltr">
            {r.replace("rounded-", "")}
          </div>
        ))}
      </Specimen>
      <Specimen label={t.shadows}>
        {["shadow-sm", "shadow-md", "shadow-lg"].map((s) => (
          <div key={s} className={`flex h-16 w-28 items-center justify-center rounded-lg bg-surface text-[11px] text-ink-3 ${s}`} dir="ltr">
            {s}
          </div>
        ))}
      </Specimen>
      <Specimen label={t.formats}>
        <dl className="grid w-full gap-3 sm:grid-cols-5">
          {[
            [t.formatLabels.money, formatMoney(1250.5)],
            [t.formatLabels.percent, formatPercent(12.3, { signed: true })],
            [t.formatLabels.date, formatDateTime("2026-11-11T13:29:00Z")],
            [t.formatLabels.phone, formatPhone("+201012345678")],
            [t.formatLabels.number, formatNumber(1240500)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-3">{label}</dt>
              <dd className="tabular font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </Specimen>
    </ShowSection>
  );
}
