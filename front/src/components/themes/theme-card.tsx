import { Crown, Eye, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeArt } from "@/components/builder/theme-art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCairo } from "@/lib/dates";
import { formatPrice } from "@/lib/price";
import type { ThemeRow } from "@/lib/themes/api";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.themeStore;

export const previewUrl = (key: string) => `/theme-preview/${encodeURIComponent(key)}`;

/** Cover screenshot when the admin uploaded one, otherwise the theme's own illustration. */
export function ThemeCover({ theme, className }: { theme: Pick<ThemeRow, "key" | "name" | "cover">; className?: string }) {
  return (
    <div className={cn("aspect-[8/5] overflow-hidden bg-muted", className)}>
      {theme.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- platform media served as-is
        <img src={theme.cover.medium} alt={theme.name} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <ThemeArt themeKey={theme.key} />
      )}
    </div>
  );
}

export function ThemePriceTag({ theme, large = false }: { theme: Pick<ThemeRow, "price" | "is_free">; large?: boolean }) {
  if (theme.is_free || !theme.price) return <Badge variant="success">{t.free}</Badge>;
  const discounted = theme.price.discount_percent > 0;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className={cn("font-extrabold tabular-nums", large ? "font-display text-2xl" : "text-base")}>{formatPrice(theme.price.final)}</span>
      {discounted ? (
        <>
          <span className="text-sm text-muted-foreground line-through">{formatPrice(theme.price.original)}</span>
          <Badge variant="success">-{theme.price.discount_percent}%</Badge>
          {large && theme.price.discount_ends_at ? <span className="text-xs text-muted-foreground">{ar.billing.pricing.discountEnds(formatCairo(theme.price.discount_ends_at, { withTime: false }))}</span> : null}
        </>
      ) : null}
    </span>
  );
}

export function ThemeBadges({ theme }: { theme: ThemeRow }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {theme.owned && !theme.is_free ? (
        <Badge variant="info">
          <Crown aria-hidden />
          {t.owned}
        </Badge>
      ) : null}
      {theme.is_new ? (
        <Badge variant="gold">
          <Sparkles aria-hidden />
          {t.isNew}
        </Badge>
      ) : null}
      {theme.is_featured ? <Badge variant="secondary">{t.featured}</Badge> : null}
      {theme.owned && theme.can_publish === false ? (
        <Badge variant="warning">
          <Lock aria-hidden />
          {t.notInPlan}
        </Badge>
      ) : null}
    </div>
  );
}

/** A theme in a grid: cover, name, tags, price, and the caller's actions. */
export function ThemeCard({ theme, actions }: { theme: ThemeRow; actions?: ReactNode }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/dashboard/themes/${theme.key}`} className="block">
        <ThemeCover theme={theme} className="border-b" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/dashboard/themes/${theme.key}`} className="font-display text-lg font-bold hover:underline">
            {theme.name}
          </Link>
          <ThemePriceTag theme={theme} />
        </div>
        {theme.short_description ? <p className="text-sm text-muted-foreground">{theme.short_description}</p> : null}
        <ThemeBadges theme={theme} />
        {theme.tags.length ? (
          <p className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {theme.tags.map((tag) => (
              <span key={tag.id}>#{tag.name}</span>
            ))}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button variant="outline" size="sm" asChild>
            <a href={previewUrl(theme.key)} target="_blank" rel="noopener">
              <Eye />
              {t.preview}
            </a>
          </Button>
          {actions}
        </div>
      </div>
    </article>
  );
}
