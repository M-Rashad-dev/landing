import { Check, Sparkles } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { ar } from "@/messages/ar";

const t = ar.auth.panel;

/**
 * Sign in / sign up frame: the form on one side, a light mint panel (large screens) on the other
 * with what the platform gives a store. The drawing is abstract shapes only (no numbers or names).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10 sm:py-8">
        <Logo />
        <main className="mx-auto flex w-full max-w-[25rem] flex-1 flex-col justify-center py-10">{children}</main>
      </div>

      <aside className="relative hidden overflow-hidden bg-brand-soft lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20" aria-hidden>
        <div className="pointer-events-none absolute -top-24 -end-20 size-80 rounded-full bg-brand/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -start-16 size-72 rounded-full bg-accent/35 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(var(--border-strong)_1px,transparent_1px)] [background-size:22px_22px]" />

        <div className="relative max-w-lg">
          <StoreDrawing />
          <span className="mt-10 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-ink">
            <Sparkles className="size-3.5" />
            {t.trial}
          </span>
          <h2 className="mt-4 font-display text-[2rem] font-bold leading-[1.35] text-ink">{t.title}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{t.text}</p>
          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {t.points.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-ink">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="text-sm font-medium text-ink">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

/** A small storefront made of shapes: a top bar and four product tiles. */
function StoreDrawing() {
  const tiles = ["bg-brand/70", "bg-accent", "bg-info/40", "bg-surface-3"];
  return (
    <div className="relative w-[22rem] rotate-[-2deg]">
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <LogoMark size={26} />
          <div className="flex gap-1.5">
            <span className="h-2 w-10 rounded-full bg-surface-3" />
            <span className="h-2 w-7 rounded-full bg-surface-3" />
            <span className="h-2 w-9 rounded-full bg-surface-3" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {tiles.map((tone) => (
            <div key={tone} className="rounded-xl border border-border p-2">
              <div className={`aspect-[4/3] rounded-lg ${tone}`} />
              <span className="mt-2 block h-2 w-3/4 rounded-full bg-surface-3" />
              <div className="mt-2 flex items-center justify-between">
                <span className="h-2 w-8 rounded-full bg-brand/60" />
                <span className="size-5 rounded-md bg-primary" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-6 -start-10 flex rotate-[3deg] items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-md">
        <span className="flex size-8 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="size-4" strokeWidth={3} />
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="h-2 w-20 rounded-full bg-ink/70" />
          <span className="h-2 w-12 rounded-full bg-surface-3" />
        </div>
      </div>
    </div>
  );
}
