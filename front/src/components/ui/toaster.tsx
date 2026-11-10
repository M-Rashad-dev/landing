"use client";

import { Toaster as Sonner, toast as sonner } from "sonner";
import { isErrorToastMuted } from "@/lib/billing/events";

export function Toaster() {
  return <Sonner dir="rtl" position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "inherit" } }} />;
}

/** Sonner's toast, except error toasts are skipped while the plan upgrade dialog explains the same failure. */
export const toast: typeof sonner = Object.assign((...args: Parameters<typeof sonner>) => sonner(...args), sonner, {
  error: ((...args: Parameters<typeof sonner.error>) => (isErrorToastMuted() ? "" : sonner.error(...args))) as typeof sonner.error,
});
