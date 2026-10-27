"use client";

import Link from "next/link";
import { ErrorState } from "@/components/dashboard/error-state";
import { ar } from "@/messages/ar";

export default function BuilderError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4">
      <ErrorState error={error} onRetry={reset} />
      <Link href="/dashboard/pages" className="text-center text-sm text-muted-foreground hover:text-foreground">
        {ar.builder.back}
      </Link>
    </main>
  );
}
