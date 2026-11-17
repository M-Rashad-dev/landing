"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { BadgeCheck, Loader2, MessageSquareText, Star } from "lucide-react";
import * as React from "react";
import { fetchReviews, useAccount, useMyReview, type ReviewSummary } from "@/lib/store/account";
import { formatDateTime } from "@/lib/format";
import { ar } from "@/messages/ar";
import { StoreLink } from "../context";
import { Stars } from "../parts";
import { ReviewForm } from "./review-form";

const t = ar.storefront.reviews;

/**
 * «تقييمات العملاء» on a product: the summary with a bar per star count, the reviews, and writing
 * one. Read fresh from the store each visit (the product page itself is cached for a minute), so a
 * new review shows at once; the page's own numbers are only the first paint.
 */
export function ProductReviewsSection({ productId, slug, summary: initial }: { productId: number; slug: string; summary: ReviewSummary }) {
  const query = useInfiniteQuery({
    queryKey: ["store-reviews", slug],
    queryFn: ({ pageParam }) => fetchReviews(slug, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    staleTime: 0,
  });
  const reviews = query.data?.pages.flatMap((p) => p.data) ?? [];
  const summary = query.data?.pages[0]?.meta.summary ?? initial;

  return (
    <section id="reviews" className="flex scroll-mt-24 flex-col gap-5 border-t pt-8">
      <h2 className="as-xl font-extrabold">{t.title}</h2>
      <WriteReview productId={productId} slug={slug} />
      {summary.count === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-(--as-card) p-4">
          <MessageSquareText className="size-6 shrink-0 as-muted" aria-hidden />
          <p className="as-sm font-bold">{t.empty}</p>
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

/** Reviewing from the product page: signed in with a delivered order that has it, else the reason why not. */
function WriteReview({ productId, slug }: { productId: number; slug: string }) {
  const account = useAccount();
  const signedIn = Boolean(account.data);
  const mine = useMyReview(productId, signedIn);
  const [open, setOpen] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  if (account.isPending) return null;
  if (!signedIn) {
    return (
      <p className="as-sm flex flex-wrap items-center gap-x-2 rounded-xl bg-(--as-soft) px-4 py-3">
        <span>{t.signInToRate}</span>
        <StoreLink href={`/account/login?next=${encodeURIComponent(`/products/${slug}#reviews`)}`} className="font-bold as-primary hover:underline">
          {t.signIn}
        </StoreLink>
      </p>
    );
  }
  if (!mine.data) return null;
  if (!mine.data.can_review) return <p className="as-sm as-muted rounded-xl bg-(--as-card) px-4 py-3">{t.notYet}</p>;

  if (open) {
    return (
      <ReviewForm
        productId={productId}
        initial={mine.data.review}
        onSaved={() => {
          setOpen(false);
          setSaved(true);
        }}
        onCancel={() => setOpen(false)}
      />
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {mine.data.review ? (
        <span className="as-sm flex items-center gap-2">
          {t.yours}: <Stars value={mine.data.review.rating} size="size-4" />
        </span>
      ) : null}
      <button type="button" onClick={() => setOpen(true)} className="as-sm flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold hover:bg-(--as-soft)">
        <Star className="size-4" aria-hidden />
        {mine.data.review ? t.edit : t.rate}
      </button>
      {saved ? <span className="as-xs font-semibold as-primary">{ar.storefront.account.reviewSaved}</span> : null}
    </div>
  );
}
