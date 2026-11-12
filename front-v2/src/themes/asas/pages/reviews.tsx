"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { BadgeCheck, Loader2, MessageSquareText } from "lucide-react";
import { fetchReviews, type ReviewSummary } from "@/lib/store/account";
import { formatDateTime } from "@/lib/format";
import { ar } from "@/messages/ar";
import { Stars } from "../parts";

const t = ar.storefront.reviews;

/** «تقييمات العملاء» on a product: the summary with a bar per star count, then the reviews. */
export function ProductReviewsSection({ slug, summary }: { slug: string; summary: ReviewSummary }) {
  const query = useInfiniteQuery({
    queryKey: ["store-reviews", slug],
    queryFn: ({ pageParam }) => fetchReviews(slug, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    enabled: summary.count > 0,
  });
  const reviews = query.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <section id="reviews" className="flex scroll-mt-24 flex-col gap-5 border-t pt-8">
      <h2 className="as-xl font-extrabold">{t.title}</h2>
      {summary.count === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-(--as-card) p-4">
          <MessageSquareText className="size-6 shrink-0 as-muted" aria-hidden />
          <div>
            <p className="as-sm font-bold">{t.empty}</p>
            <p className="as-xs as-muted">{t.emptyHint}</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 @3xl:grid-cols-[16rem_1fr]">
          <div className="flex flex-col gap-3 rounded-xl bg-(--as-card) p-4">
            <p className="flex items-baseline gap-2">
              <span className="as-3xl font-extrabold">{summary.average}</span>
              <span className="as-sm as-muted">/ 5</span>
            </p>
            <Stars value={summary.average} label={t.outOf(summary.average)} />
            <p className="as-xs as-muted">{t.count(summary.count)}</p>
            <ul className="flex flex-col gap-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = summary.stars[String(n)] ?? 0;
                return (
                  <li key={n} className="as-xs flex items-center gap-2" aria-label={`${t.stars(n)}: ${count}`}>
                    <span className="w-3 tabular-nums">{n}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-(--as-line)">
                      <span className="block h-full rounded-full bg-(--as-secondary)" style={{ width: `${summary.count ? (count / summary.count) * 100 : 0}%` }} />
                    </span>
                    <span className="as-muted w-6 text-end tabular-nums">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            {query.isPending ? <div className="h-28 animate-pulse rounded-xl bg-(--as-soft)" aria-busy /> : null}
            <ul className="flex flex-col divide-y">
              {reviews.map((r) => (
                <li key={r.id} className="flex flex-col gap-1.5 py-4 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="as-sm font-bold">{r.name}</span>
                    {r.verified ? (
                      <span className="as-xs flex items-center gap-1 font-semibold as-primary">
                        <BadgeCheck className="size-3.5" aria-hidden />
                        {t.verified}
                      </span>
                    ) : null}
                    <span className="as-xs as-muted ms-auto">{formatDateTime(r.created_at).split(" ")[0]}</span>
                  </div>
                  <Stars value={r.rating} size="size-3.5" />
                  {r.text ? <p className="as-sm whitespace-pre-line">{r.text}</p> : null}
                </li>
              ))}
            </ul>
            {query.hasNextPage ? (
              <button type="button" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} className="as-sm flex items-center justify-center gap-2 self-center rounded-lg border px-4 py-2 font-semibold hover:bg-(--as-soft)">
                {query.isFetchingNextPage ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t.more}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
