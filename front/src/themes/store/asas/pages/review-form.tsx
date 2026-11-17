"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { useReviewForm } from "@/themes/store/shared/use-review-form";
import { FormField, inputClass, StarInput } from "../parts";

const t = ar.storefront.account;

/** Writing (or editing) a review; used on the product page and on «طلباتي». */
export function ReviewForm({ productId, initial, onSaved, onCancel }: { productId: number; initial: { rating: number; text: string | null } | null; onSaved: () => void; onCancel: () => void }) {
  const { rating, setRating, text, setText, busy, error, submit } = useReviewForm(productId, initial, onSaved);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
      className="flex flex-col gap-3 rounded-xl bg-(--as-card) p-3"
    >
      <StarInput value={rating} onChange={setRating} label={t.pickStars} />
      <FormField id={`rv-${productId}`} label={t.reviewText} optional>
        <textarea id={`rv-${productId}`} rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.reviewPlaceholder} className={cn(inputClass, "h-auto py-2")} />
      </FormField>
      {error ? (
        <p className="as-xs font-semibold text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="as-btn as-sm h-9 disabled:opacity-60">
          {t.reviewSave}
        </button>
        <button type="button" onClick={onCancel} className="as-sm h-9 rounded-lg border px-3 font-semibold">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
