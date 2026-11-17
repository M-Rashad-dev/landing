"use client";

import * as React from "react";
import { normalizePhone } from "@/lib/phone";
import type { TrackedOrder } from "@/lib/store/types";
import { ar } from "@/messages/ar";

const t = ar.storefront.track;

export type TrackState = { kind: "idle" | "loading" } | { kind: "error"; message: string } | { kind: "found"; order: TrackedOrder };

async function lookup(body: Record<string, unknown>): Promise<TrackState> {
  try {
    const response = await fetch("/api/public/track", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as { data?: TrackedOrder };
    if (response.ok && json.data) return { kind: "found", order: json.data };
    return { kind: "error", message: response.status === 404 || response.status === 422 ? t.notFound : response.status === 429 ? t.tooMany : t.failed };
  } catch {
    return { kind: "error", message: ar.storefront.checkout.errors.network };
  }
}

/** Order tracking: number + phone → where the order is (or straight from the private link's token). */
export function useTrackOrder(initialNumber: string, token: string | null) {
  const [number, setNumber] = React.useState(initialNumber);
  const [phone, setPhone] = React.useState("");
  const [errors, setErrors] = React.useState<{ number?: string; phone?: string }>({});
  const [state, setState] = React.useState<TrackState>(token ? { kind: "loading" } : { kind: "idle" });

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void lookup({ token }).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async () => {
    const next: typeof errors = {};
    if (!/^\d{1,9}$/.test(number.trim().replace(/^#/, ""))) next.number = t.numberError;
    if (!normalizePhone(phone)) next.phone = ar.storefront.checkout.errors.phone;
    setErrors(next);
    if (next.number || next.phone) return;
    setState({ kind: "loading" });
    setState(await lookup({ order_number: Number(number.trim().replace(/^#/, "")), phone }));
  };

  /** Back to the empty form for another order. */
  const reset = () => {
    setState({ kind: "idle" });
    setNumber("");
  };

  return { number, setNumber, phone, setPhone, errors, state, submit, reset };
}
