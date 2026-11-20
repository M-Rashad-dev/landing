"use client";

import { useQueryClient } from "@tanstack/react-query";
import { History } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { type ChangeStatus, changeSetKey, useChangeSets } from "./api";
import { ChangeSetCard } from "./change-set-card";

const t = ar.copilot;

const FILTERS: (ChangeStatus | "all")[] = ["all", "proposed", "applied", "rejected", "reverted"];

/** /dashboard/copilot/history: every change the copilot prepared, with the same card (and buttons) as the chat. */
export function CopilotHistoryPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState<ChangeStatus | "all">("all");
  const list = useChangeSets(page, status === "all" ? undefined : status);

  React.useEffect(() => {
    // The cards read their own query: fill it from the list so they don't fetch again.
    list.data?.data.forEach((set) => queryClient.setQueryData(changeSetKey(set.id), set));
  }, [list.data, queryClient]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">{t.history.title}</h1>
        <p className="mt-1 text-sm text-ink-3">{t.history.subtitle}</p>
      </div>
      <Segmented
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={FILTERS.map((f) => ({ value: f, label: f === "all" ? t.history.all : t.change.status[f] }))}
      />
      {list.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : list.isError ? (
        <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState icon={History} title={t.history.emptyTitle} description={t.history.emptyHint} />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {list.data.data.map((set) => (
              <ChangeSetCard key={set.id} id={set.id} />
            ))}
          </div>
          {list.data.meta.last_page > 1 ? (
            <div className="flex items-center justify-center gap-2">
              <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {ar.common.previous}
              </Button>
              <span className="text-xs text-ink-3">
                {page} / {list.data.meta.last_page}
              </span>
              <Button type="button" size="sm" variant="outline" disabled={page >= list.data.meta.last_page} onClick={() => setPage((p) => p + 1)}>
                {ar.common.next}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
