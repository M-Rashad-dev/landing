"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpLeft, Check, FileSpreadsheet, RotateCcw, Trash2, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { errorMessage } from "@/lib/api/errors";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import {
  type ChangeItem,
  type ChangeSet,
  type ChangeStatus,
  acceptChangeSet,
  changeSetFileUrl,
  changeSetItems,
  changeSetKey,
  rejectChangeSet,
  revertChangeSet,
  useChangeSet,
} from "./api";

const t = ar.copilot.change;

const TONE: Record<ChangeStatus, "neutral" | "brand-soft" | "success" | "warning" | "danger" | "info" | "attention"> = {
  estimate: "attention",
  running: "info",
  proposed: "attention",
  applying: "info",
  applied: "success",
  rejected: "neutral",
  expired: "neutral",
  failed: "danger",
  reverted: "neutral",
};

/** Our own dashboard pages only (the server builds the links; this is a second guard). */
function safeHref(href: string | null | undefined): string | null {
  return typeof href === "string" && href.startsWith("/dashboard/") ? href : null;
}

function show(kind: string, value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return kind === "money" ? formatMoney(value) : value;
}

function Counts({ set }: { set: ChangeSet }) {
  const c = set.counts;
  const parts: string[] = [];
  if (set.kind === "create" && set.status === "proposed") parts.push(t.drafts(c.pending ?? set.items_count));
  else if (set.status === "proposed") parts.push(t.willChange(c.pending ?? 0));
  else if (set.status === "applying") parts.push(t.progress(set.applied_count, set.items_count));
  else if (set.applied_count > 0) parts.push(t.applied(set.applied_count, set.items_count));
  if ((c.skipped_invalid ?? 0) > 0) parts.push(t.skipped(c.skipped_invalid ?? 0));
  if ((c.skipped_stale ?? 0) > 0) parts.push(t.stale(c.skipped_stale ?? 0));
  if ((c.failed ?? 0) > 0) parts.push(t.failedCount(c.failed ?? 0));
  return <p className="text-[11px] text-ink-3">{parts.join(" · ")}</p>;
}

function Items({ set, items }: { set: ChangeSet; items: ChangeItem[] }) {
  if (set.columns.length === 0) {
    // New drafts: their names, each a link to its page.
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const href = safeHref(item.url);
          const chip = <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[12px] text-ink">{item.label}</span>;
          return href ? (
            <Link key={item.id} href={href} className="hover:opacity-80">
              {chip}
            </Link>
          ) : (
            <React.Fragment key={item.id}>{chip}</React.Fragment>
          );
        })}
      </div>
    );
  }
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-border">
      <table className="w-full min-w-max text-start text-[12px]">
        <thead className="sticky top-0 bg-surface-2 text-ink-2">
          <tr>
            <th scope="col" className="px-2.5 py-1.5 text-start font-semibold">
              {set.target_label}
            </th>
            {set.columns.map((c) => (
              <th key={c.key} scope="col" className="px-2.5 py-1.5 text-start font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const href = safeHref(item.url);
            const label = t.itemStatus[item.status];
            const off = item.status !== "pending" && item.status !== "applied";
            return (
              <tr key={item.id} className={cn("border-t border-border", off && "opacity-60")}>
                <td className="px-2.5 py-1.5 align-top">
                  {href ? (
                    <Link href={href} className="font-semibold text-brand-strong hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="font-semibold text-ink">{item.label}</span>
                  )}
                  {label ? <span className="ms-1.5 text-[10px] text-ink-3">({label})</span> : null}
                  {item.note ? <p className="mt-0.5 max-w-60 whitespace-normal text-[11px] text-warning">{item.note}</p> : null}
                </td>
                {set.columns.map((c) => (
                  <td key={c.key} className="px-2.5 py-1.5 align-top tabular-nums">
                    {c.key in item.after ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-danger line-through">{show(c.kind, item.before[c.key])}</span>
                        <ArrowLeft className="size-3 text-ink-3" aria-hidden />
                        <span className="font-semibold text-success">{show(c.kind, item.after[c.key])}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A change under a copilot reply (and on the history page): what will change / what was created, the records with
 * their before → after, and the merchant's buttons. Nothing in the store changes until he presses them.
 */
export function ChangeSetCard({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const query = useChangeSet(id);
  const [more, setMore] = React.useState<ChangeItem[]>([]);
  const [page, setPage] = React.useState(1);
  const [lastPage, setLastPage] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState<"accept" | "reject" | "revert" | "more" | null>(null);
  const [confirm, setConfirm] = React.useState<"remove" | "revert" | null>(null);

  if (query.isPending) return <Skeleton className="h-28 w-full rounded-xl" />;
  if (query.isError) return <ErrorState message={t.loadError} onRetry={() => void query.refetch()} />;
  const set = query.data;

  const items = [...set.items, ...more.filter((m) => !set.items.some((i) => i.id === m.id))];
  const canLoadMore = lastPage === null ? set.has_more_items : page < lastPage;
  const link = safeHref(set.link);

  async function act(kind: "accept" | "reject" | "revert") {
    setBusy(kind);
    setConfirm(null);
    try {
      const fn = kind === "accept" ? acceptChangeSet : kind === "reject" ? rejectChangeSet : revertChangeSet;
      const result = await fn(set.id);
      queryClient.setQueryData(changeSetKey(set.id), kind === "revert" ? { ...set, status: "reverted" as const, can: { accept: false, reject: false, revert: false } } : result);
      void queryClient.invalidateQueries({ queryKey: ["copilot"] });
      toast.success(kind === "accept" ? t.acceptToast : kind === "reject" ? t.rejectToast : t.revertToast);
    } catch (err) {
      toast.error(errorMessage(err));
      void query.refetch();
    } finally {
      setBusy(null);
    }
  }

  async function loadMore() {
    setBusy("more");
    try {
      // The card holds the first 10; pages of 50 come after.
      const next = more.length === 0 ? 1 : page + 1;
      const result = await changeSetItems(set.id, next);
      setMore((prev) => [...prev, ...result.items]);
      setPage(next);
      setLastPage(result.last_page);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const isCreate = set.kind === "create";

  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-[13px] font-bold leading-relaxed text-ink">{set.summary}</p>
        <Badge tone={TONE[set.status]} size="sm">
          {ar.copilot.change.status[set.status]}
        </Badge>
      </div>
      <Counts set={set} />

      {set.status === "applying" ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={set.items_count} aria-valuenow={set.applied_count}>
          <div className="h-full bg-brand transition-[width]" style={{ width: `${set.items_count > 0 ? Math.round((set.applied_count / set.items_count) * 100) : 0}%` }} />
        </div>
      ) : null}

      {items.length > 0 ? <Items set={set} items={items} /> : null}
      {set.error ? <p className="text-[11px] text-danger">{set.error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {set.can.accept ? (
          <Button type="button" size="sm" loading={busy === "accept"} disabled={busy !== null} onClick={() => void act("accept")}>
            <Check className="size-3.5" />
            {isCreate ? (set.keep_draft ? t.keepDraft : t.publish) : t.apply}
          </Button>
        ) : null}
        {set.can.reject ? (
          <Button type="button" size="sm" variant="outline" loading={busy === "reject"} disabled={busy !== null} onClick={() => (isCreate ? setConfirm("remove") : void act("reject"))}>
            {isCreate ? <Trash2 className="size-3.5" /> : <X className="size-3.5" />}
            {isCreate ? t.remove : t.reject}
          </Button>
        ) : null}
        {set.can.revert ? (
          <Button type="button" size="sm" variant="outline" loading={busy === "revert"} disabled={busy !== null} onClick={() => setConfirm("revert")}>
            <RotateCcw className="size-3.5" />
            {t.revert}
          </Button>
        ) : null}
        {canLoadMore ? (
          <Button type="button" size="sm" variant="ghost" loading={busy === "more"} onClick={() => void loadMore()}>
            {t.more}
          </Button>
        ) : null}
        {set.columns.length > 0 ? (
          <a href={changeSetFileUrl(set.id)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-strong hover:underline">
            <FileSpreadsheet className="size-3.5" />
            {t.fullPreview}
          </a>
        ) : null}
        {link ? (
          <Link href={link} className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-2 hover:text-ink">
            <ArrowUpLeft className="size-3.5" />
            {t.openPage}
          </Link>
        ) : null}
      </div>
      {set.status === "proposed" && !isCreate ? <p className="text-[10px] text-ink-3">{t.expiresHint}</p> : null}
      {set.can.revert ? <p className="text-[10px] text-ink-3">{t.revertHint}</p> : null}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "revert" ? t.revertTitle : t.removeTitle}
        description={confirm === "revert" ? t.revertDesc : t.removeDesc}
        confirmLabel={confirm === "revert" ? t.revert : t.remove}
        destructive={confirm === "remove"}
        loading={busy === "reject" || busy === "revert"}
        onConfirm={() => void act(confirm === "revert" ? "revert" : "reject")}
      />
    </div>
  );
}
