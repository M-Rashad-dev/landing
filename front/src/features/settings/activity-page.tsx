"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { api, apiPage } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { ar } from "@/messages/ar";
import type { PermissionPage, StaffMember } from "./staff-page";

const t = ar.staff;
type Line = { id: number; user: string | null; summary: string; permission: string | null; created_at: string };

/** «سجل النشاط»: who changed what in the store, newest first. */
export function ActivityPage() {
  const [userId, setUserId] = React.useState("");
  const [page, setPage] = React.useState("");
  const people = useQuery({ queryKey: ["staff"], queryFn: () => api<StaffMember[]>("/dashboard/staff"), retry: false });
  const pages = useQuery({ queryKey: ["staff-permissions"], queryFn: () => api<PermissionPage[]>("/dashboard/staff/permissions"), retry: false });
  const lines = useInfiniteQuery({
    queryKey: ["activity", userId, page],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => apiPage<Line>(`/dashboard/activity?${new URLSearchParams({ page: String(pageParam), ...(userId ? { user_id: userId } : {}), ...(page ? { area: page } : {}) })}`),
    getNextPageParam: (last) => (last.meta && last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  });

  const rows = lines.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <Panel className="max-w-4xl">
      <PanelHeader title={t.activity} description={t.activityText} />
      <PanelBody className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <Select aria-label={t.everyone} className="w-48" value={userId} onValueChange={setUserId} emptyLabel={t.everyone} options={(people.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))} />
          <Select aria-label={t.allPages} className="w-48" value={page} onValueChange={setPage} emptyLabel={t.allPages} options={(pages.data ?? []).map((p) => ({ value: p.page, label: p.label }))} />
        </div>
        {lines.isPending ? (
          <Skeleton className="h-60 rounded-xl" />
        ) : lines.isError ? (
          <ErrorState onRetry={() => void lines.refetch()} message={errorMessage(lines.error)} />
        ) : rows.length === 0 ? (
          <EmptyState compact icon={History} title={t.noActivity} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span>
                  <b>{l.user ?? t.owner}</b> · {l.summary}
                </span>
                <span className="text-xs text-ink-3 tabular">{formatDateTime(l.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
        {lines.hasNextPage ? (
          <Button variant="outline" size="sm" className="self-center" loading={lines.isFetchingNextPage} onClick={() => void lines.fetchNextPage()}>
            {t.more}
          </Button>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
