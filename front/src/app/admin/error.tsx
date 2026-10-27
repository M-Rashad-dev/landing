"use client";

import { ErrorState } from "@/components/dashboard/error-state";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState error={error} onRetry={reset} className="mt-6" />;
}
