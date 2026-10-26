"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

export function ErrorState({ error, onRetry, className }: { error?: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center", className)}>
      <AlertTriangle className="mb-3 size-8 text-destructive" aria-hidden />
      <p className="font-bold">{ar.errors.loadFailed}</p>
      <p className="mt-1 text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RotateCw />
          {ar.common.retry}
        </Button>
      ) : null}
    </div>
  );
}
