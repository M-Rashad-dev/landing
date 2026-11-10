"use client";

import { Palette, Plus, Store } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ThemeCard } from "@/components/themes/theme-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyThemes, type ThemeKind } from "@/lib/themes/api";
import { ar } from "@/messages/ar";

const t = ar.themeStore;

/** «ثيماتي»: free and owned themes (by kind), then the newest paid themes to buy. */
export function MyThemes() {
  const { data, isPending, isError, error, refetch } = useMyThemes();
  const kinds = Array.from(new Set((data ?? []).map((theme) => theme.kind)));
  const [kind, setKind] = useState<ThemeKind>("landing");

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-80 rounded-2xl" />
        ))}
      </div>
    );
  }

  const mine = data.filter((theme) => theme.owned && theme.kind === kind);
  const latestPaid = data
    .filter((theme) => !theme.owned && !theme.is_free)
    .sort((a, b) => (b.released_at ?? "").localeCompare(a.released_at ?? ""))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        {kinds.length > 1 ? (
          <Tabs value={kind} onValueChange={(v) => setKind(v as ThemeKind)}>
            <TabsList>
              {kinds.map((k) => (
                <TabsTrigger key={k} value={k}>
                  {t.kinds[k]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
        {mine.length === 0 ? (
          <EmptyState icon={Palette} title={t.noMine} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((theme) => (
              <li key={theme.key}>
                <ThemeCard
                  theme={theme}
                  actions={
                    theme.kind === "landing" ? (
                      <Button size="sm" asChild>
                        <Link href={`/dashboard/pages/new?theme=${theme.key}`}>
                          <Plus />
                          {t.use}
                        </Link>
                      </Button>
                    ) : null
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {latestPaid.length ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">{t.latestPaid}</h2>
            <Button variant="outline" asChild>
              <Link href="/dashboard/themes/store">
                <Store />
                {t.browse}
              </Link>
            </Button>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latestPaid.map((theme) => (
              <li key={theme.key}>
                <ThemeCard
                  theme={theme}
                  actions={
                    <Button size="sm" variant="gold" asChild>
                      <Link href={`/dashboard/themes/${theme.key}`}>{t.details}</Link>
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
