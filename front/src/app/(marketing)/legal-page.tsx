import Link from "next/link";
import { AppRoot } from "@/components/app-root";
import type { Support } from "@/lib/billing/payments";
import { ar } from "@/messages/ar";

export const LEGAL_LINKS = [
  { href: "/terms", label: ar.legal.terms },
  { href: "/refund-policy", label: ar.legal.refund },
  { href: "/privacy", label: ar.legal.privacy },
] as const;

/** Terms / refund / privacy: plain text from messages, the support contact from the admin settings. */
export function LegalPage({ title, paragraphs, support }: { title: string; paragraphs: readonly string[]; support: Support | null }) {
  return (
    <AppRoot>
      <div className="min-h-dvh bg-background">
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5">
          <Link href="/" className="text-lg font-extrabold text-primary">
            {ar.app.name}
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl px-4 pb-16">
          <h1 className="mt-6 text-3xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ar.legal.updated}</p>
          <ol className="mt-6 flex list-inside list-decimal flex-col gap-3 leading-relaxed">
            {paragraphs.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          {support && (support.email || support.whatsapp) ? (
            <section className="mt-10 rounded-2xl border bg-card p-5">
              <h2 className="font-bold">{ar.legal.contact}</h2>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {support.email ? (
                  <li>
                    {ar.legal.email}:{" "}
                    <a href={`mailto:${support.email}`} dir="ltr" className="font-semibold text-primary hover:underline">
                      {support.email}
                    </a>
                  </li>
                ) : null}
                {support.whatsapp ? (
                  <li>
                    {ar.legal.whatsapp}:{" "}
                    <a href={`https://wa.me/${support.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" dir="ltr" className="font-semibold text-primary hover:underline">
                      {support.whatsapp}
                    </a>
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}
        </main>
      </div>
    </AppRoot>
  );
}
