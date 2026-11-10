"use client";

import { ArrowRight, Check, Crown, Eye, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PRICING_PATH, usePlan } from "@/components/billing/plan";
import { ErrorState } from "@/components/dashboard/error-state";
import { previewUrl, ThemeBadges, ThemeCover, ThemePriceTag } from "@/components/themes/theme-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/api/errors";
import { buyTheme, useThemeDetail, type ThemeRow } from "@/lib/themes/api";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.themeStore;

export function ThemeDetail({ themeKey }: { themeKey: string }) {
  const { data, isPending, isError, error, refetch } = useThemeDetail(themeKey);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="aspect-[8/5] rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/dashboard/themes/store">
          <ArrowRight />
          {t.back}
        </Link>
      </Button>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <Gallery theme={data} />
          {data.description ? <p className="leading-relaxed">{data.description}</p> : null}
          {data.features?.length ? (
            <section>
              <h2 className="mb-2 font-display text-lg font-bold">{t.features}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="size-4 text-success" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <BuyCard theme={data} />
      </div>
    </>
  );
}

function Gallery({ theme }: { theme: ThemeRow }) {
  const images = theme.images ?? [];
  const [active, setActive] = useState(0);
  const current = images[active];

  if (!current) return <ThemeCover theme={theme} className="rounded-2xl border" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center overflow-hidden rounded-2xl border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- platform media served as-is */}
        <img src={current.urls.large} alt={theme.name} className={cn("max-h-[32rem] w-full object-contain", current.kind === "mobile" && "max-w-xs")} />
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`${theme.name} ${index + 1}`}
              aria-pressed={index === active}
              className={cn("size-20 shrink-0 overflow-hidden rounded-lg border-2", index === active ? "border-primary" : "border-transparent")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail */}
              <img src={image.urls.medium} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BuyCard({ theme }: { theme: ThemeRow }) {
  const router = useRouter();
  const plan = usePlan();
  const [busy, setBusy] = useState(false);
  const canBuyOnPlan = plan?.features.buy_themes ?? false;

  async function buy() {
    setBusy(true);
    try {
      const invoice = await buyTheme(theme.key);
      router.push(`/dashboard/billing/invoices/${invoice.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Card className="flex h-fit flex-col gap-4 p-5 lg:sticky lg:top-24">
      <div>
        <h1 className="font-display text-2xl font-extrabold">{theme.name}</h1>
        {theme.short_description ? <p className="mt-1 text-sm text-muted-foreground">{theme.short_description}</p> : null}
      </div>
      <ThemePriceTag theme={theme} large />
      <ThemeBadges theme={theme} />
      {theme.tags.length ? (
        <p className="flex flex-wrap gap-1.5 text-sm text-muted-foreground">
          {theme.tags.map((tag) => (
            <span key={tag.id}>#{tag.name}</span>
          ))}
        </p>
      ) : null}
      {theme.min_plan ? <p className="text-xs text-muted-foreground">{t.minPlan(theme.min_plan.name)}</p> : null}
      {theme.version ? <p className="text-xs text-muted-foreground">{t.version(theme.version)}</p> : null}

      <div className="flex flex-col gap-2">
        <Button variant="outline" asChild>
          <a href={previewUrl(theme.key)} target="_blank" rel="noopener">
            <Eye />
            {t.preview}
          </a>
        </Button>
        {theme.owned ? (
          theme.kind === "landing" ? (
            <Button asChild>
              <Link href={`/dashboard/pages/new?theme=${theme.key}`}>
                <Plus />
                {t.use}
              </Link>
            </Button>
          ) : null
        ) : !canBuyOnPlan ? (
          <Button variant="gold" asChild>
            <Link href={PRICING_PATH}>
              <Crown />
              {t.upgradeToBuy}
            </Link>
          </Button>
        ) : (
          <Button variant="gold" onClick={buy} loading={busy}>
            <Crown />
            {theme.price ? t.buyFor(formatPrice(theme.price.final)) : t.buy}
          </Button>
        )}
      </div>
    </Card>
  );
}
