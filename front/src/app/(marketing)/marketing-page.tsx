import { LayoutTemplate, Rocket, ShoppingBag, Smartphone } from "lucide-react";
import { AppRoot } from "@/components/app-root";
import { Button } from "@/components/ui/button";
import { ar } from "@/messages/ar";

const FEATURES = [
  { icon: LayoutTemplate, title: ar.marketing.feature1Title, text: ar.marketing.feature1Text },
  { icon: ShoppingBag, title: ar.marketing.feature2Title, text: ar.marketing.feature2Text },
  { icon: Smartphone, title: ar.marketing.feature3Title, text: ar.marketing.feature3Text },
];

export function MarketingPage({ appUrl }: { appUrl: string }) {
  return (
    <AppRoot>
      <div className="flex min-h-dvh flex-col bg-gradient-to-b from-secondary via-background to-background">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
          <span className="flex items-center gap-2 text-lg font-extrabold text-primary">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Rocket className="size-5" aria-hidden />
            </span>
            {ar.app.name}
          </span>
          <Button variant="outline" asChild>
            <a href={`${appUrl}/login`}>{ar.marketing.login}</a>
          </Button>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4">
          <section className="py-16 text-center sm:py-24">
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">{ar.marketing.heroTitle}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">{ar.marketing.heroText}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <a href={`${appUrl}/register`}>{ar.marketing.start}</a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href={`${appUrl}/login`}>{ar.marketing.login}</a>
              </Button>
            </div>
          </section>

          <section className="grid gap-5 pb-20 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-secondary text-primary">
                  <feature.icon className="size-6" aria-hidden />
                </div>
                <h2 className="text-lg font-bold">{feature.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
              </div>
            ))}
          </section>
        </main>

        <footer className="border-t py-6 text-center text-sm text-muted-foreground">{ar.marketing.copyright(new Date().getFullYear())}</footer>
      </div>
    </AppRoot>
  );
}
