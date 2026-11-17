"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { errorMessage } from "@/lib/api/errors";
import { accountKeys, writeReview } from "@/lib/store/account";
import { ar } from "@/messages/ar";

const t = ar.storefront.account;

/** Writing (or editing) a review: the stars and text, saving, and refreshing what shows it. */
export function useReviewForm(productId: number, initial: { rating: number; text: string | null } | null, onSaved: () => void) {
  const queryClient = useQueryClient();
  const [rating, setRating] = React.useState(initial?.rating ?? 0);
  const [text, setText] = React.useState(initial?.text ?? "");
  const [state, setState] = React.useState<{ kind: "idle" | "busy" } | { kind: "error"; message: string }>({ kind: "idle" });

  const submit = async () => {
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

  return { rating, setRating, text, setText, busy: state.kind === "busy", error: state.kind === "error" ? state.message : null, submit };
}
