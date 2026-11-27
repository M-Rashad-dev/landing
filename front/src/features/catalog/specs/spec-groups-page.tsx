"use client";

import { ChevronLeft, ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { errorMessage } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/session-context";
import { ar } from "@/messages/ar";
import { useSpecGroups } from "./api";

const t = ar.specs.groups;

/** «مجموعات المواصفات»: the store's reusable spec tables. */
export function SpecGroupsPage() {
  const can = useCan();
  const query = useSpecGroups();
  const list = query.data?.data ?? [];
  const max = query.data?.meta.max ?? null;
  const atLimit = max !== null && list.length >= max;
  const canCreate = can("products.create");

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          canCreate ? (
            atLimit ? (
              <Button disabled>
                <Plus />
                {t.add}
              </Button>
            ) : (
              <Button asChild>
                <Link href="/dashboard/catalog/spec-groups/new">
                  <Plus />
                  {t.add}
                </Link>
              </Button>
            )
          ) : null
        }
      />

      {query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState icon={ListChecks} title={t.emptyTitle} description={t.emptyText} />
          <div className="grid gap-3 px-5 pb-6 sm:grid-cols-3">
            {t.examples.map((example) => (
              <div key={example.key} className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2/40 p-4">
                <p className="font-display text-sm font-semibold">{example.name}</p>
                <p className="text-[13px] leading-6 text-ink-3">{example.rows.join("، ")}</p>
                {canCreate ? (
                  <Button variant="outline" size="sm" className="mt-auto self-start" asChild>
                    <Link href={`/dashboard/catalog/spec-groups/new?example=${example.key}`}>
                      <Plus />
                      {t.examplesTitle}
                    </Link>
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {max !== null ? <p className="mb-3 text-xs text-ink-3">{t.limit(list.length, max)}</p> : null}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((group) => (
              <li key={group.id}>
                <Link
                  href={`/dashboard/catalog/spec-groups/${group.id}`}
                  className="group flex h-full items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2/40"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <ListChecks className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[15px] font-semibold">{group.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral" size="sm">
                        {t.rows(group.rows_count)}
                      </Badge>
                      <Badge tone={group.products_count > 0 ? "brand-soft" : "neutral"} size="sm">
                        {t.products(group.products_count)}
                      </Badge>
                    </span>
                  </span>
                  <ChevronLeft className="size-4 shrink-0 text-ink-3 transition-transform group-hover:-translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
