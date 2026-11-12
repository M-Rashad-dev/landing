"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { errorMessage } from "@/lib/api/errors";
import { accountKeys, writeReview } from "@/lib/store/account";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { FormField, inputClass, StarInput } from "../parts";

const t = ar.storefront.account;

/** Writing (or editing) a review; used on the product page and on «طلباتي». */
export function ReviewForm({ productId, initial, onSaved, onCancel }: { productId: number; initial: { rating: number; text: string | null } | null; onSaved: () => void; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const [rating, setRating] = React.useState(initial?.rating ?? 0);
  const [text, setText] = React.useState(initial?.text ?? "");
  const [state, setState] = React.useState<{ kind: "idle" | "busy" } | { kind: "error"; message: string }>({ kind: "idle" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setState({ kind: "error", message: t.pickStars });
      return;
    }
    setState({ kind: "busy" });
    try {
      await writeReview({ product_id: productId, rating, text: text.trim() || null });
      // The product's reviews, my review, and my orders all change.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store-reviews"] }),
        queryClient.invalidateQueries({ queryKey: accountKeys.myReview(productId) }),
        queryClient.invalidateQueries({ queryKey: ["store-account", "order"] }),
      ]);
      setState({ kind: "idle" });
      onSaved();
    } catch (err) {
      setState({ kind: "error", message: errorMessage(err) });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-xl bg-(--as-card) p-3">
      <StarInput value={rating} onChange={setRating} label={t.pickStars} />
      <FormField id={`rv-${productId}`} label={t.reviewText} optional>
        <textarea id={`rv-${productId}`} rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.reviewPlaceholder} className={cn(inputClass, "h-auto py-2")} />
      </FormField>
      {state.kind === "error" ? (
        <p className="as-xs font-semibold text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" disabled={state.kind === "busy"} className="as-btn as-sm h-9 disabled:opacity-60">
          {t.reviewSave}
        </button>
        <button type="button" onClick={onCancel} className="as-sm h-9 rounded-lg border px-3 font-semibold">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
