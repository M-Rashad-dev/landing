"use client";

import { Search, Store } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { ThemeCard } from "@/components/themes/theme-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useThemeStore } from "@/lib/themes/api";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.themeStore;

export function StoreBrowser() {
  const [kind, setKind] = useState("");
  const [tag, setTag] = useState("");
  const [price, setPrice] = useState("");
  const [sort, setSort] = useState("newest");
  const [q, setQ] = useState("");
  const search = useDeferredValue(q.trim());
  const { data, isPending, isError, error, refetch, isFetching } = useThemeStore({ kind: kind || undefined, tag: tag || undefined, price: price || undefined, sort, q: search || undefined });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={kind || "all"} onValueChange={(v) => setKind(v === "all" ? "" : v)}>
            <TabsList>
              {["all", "landing", "store"].map((k) => (
                <TabsTrigger key={k} value={k}>
                  {t.kinds[k]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className="ps-9" aria-label={t.search} />
          </div>
          <Select className="w-40" aria-label={t.priceFilter.all} value={price} onChange={(e) => setPrice(e.target.value)} options={[{ value: "", label: t.priceFilter.all }, { value: "free", label: t.priceFilter.free }, { value: "paid", label: t.priceFilter.paid }]} />
          <Select className="w-44" aria-label={t.sorts.newest} value={sort} onChange={(e) => setSort(e.target.value)} options={Object.entries(t.sorts).map(([value, label]) => ({ value, label }))} />
        </div>
        {data?.tags.length ? (
          <div className="flex flex-wrap gap-2" aria-label={t.allTags}>
            {[{ id: 0, slug: "", name: t.allTags }, ...data.tags].map((item) => (
              <Button key={item.id} type="button" size="sm" variant={tag === item.slug ? "default" : "outline"} aria-pressed={tag === item.slug} onClick={() => setTag(item.slug)}>
                {item.slug ? `#${item.name}` : item.name}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isPending || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      ) : data.themes.length === 0 ? (
        <EmptyState icon={Store} title={t.empty} />
      ) : (
        <ul className={cn("grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3", isFetching && "opacity-70")}>
          {data.themes.map((theme) => (
            <li key={theme.key}>
              <ThemeCard
                theme={theme}
                actions={
                  <Button size="sm" variant={theme.owned ? "outline" : "gold"} asChild>
                    <Link href={`/dashboard/themes/${theme.key}`}>{t.details}</Link>
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
