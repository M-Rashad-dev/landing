import { Check } from "lucide-react";
import Link from "next/link";
import { AppRoot } from "@/components/app-root";
import { BrandMark } from "@/components/dashboard/brand-mark";
import { ar } from "@/messages/ar";

/** Split screen: the form, and an ink brand panel (large screens) with what the platform gives. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppRoot>
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="flex flex-col px-4 py-8 sm:px-8">
          <Link href="/" className="flex w-fit items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-lg font-semibold">{ar.app.name}</span>
          </Link>
          <main className="page-enter mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</main>
        </div>

        <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-center">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(600px 400px at 85% 10%, color-mix(in srgb, var(--primary) 55%, transparent), transparent 70%), radial-gradient(500px 360px at 10% 95%, color-mix(in srgb, var(--gold) 28%, transparent), transparent 70%)",
            }}
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(var(--sidebar-foreground)_1px,transparent_1px),linear-gradient(90deg,var(--sidebar-foreground)_1px,transparent_1px)] [background-size:44px_44px]" aria-hidden />
          <div className="relative max-w-md">
            <h2 className="font-display text-4xl font-semibold leading-tight text-white">{ar.auth.panelTitle}</h2>
            <p className="mt-4 text-base leading-relaxed text-sidebar-foreground">{ar.auth.panelText}</p>
            <ul className="mt-8 flex flex-col gap-3.5">
              {ar.auth.panelPoints.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gold text-gold-foreground">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                  <span className="text-[15px] text-white/90">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </AppRoot>
  );
}
