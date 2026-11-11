"use client";

import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, ErrorState, LockedNotice, Skeleton, toast } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { ar } from "@/messages/ar";
import { ShowSection, Specimen } from "../frame";

const f = ar.showcase.feedback;

export function FeedbackSection() {
  return (
    <ShowSection id="feedback" title={ar.showcase.sections.feedback.title} description={ar.showcase.sections.feedback.description}>
      <Specimen label={f.alerts} stack>
        <Alert tone="attention" title={f.attention} action={<Button size="sm" variant="outline">{f.alertAction}</Button>}>
          {f.attentionText}
        </Alert>
        <Alert tone="info" title={f.info}>
          {f.infoText}
        </Alert>
        <Alert tone="success" title={f.success}>
          {f.successText}
        </Alert>
        <Alert tone="warning" title={f.warning}>
          {f.warningText}
        </Alert>
        <Alert tone="danger" title={f.danger}>
          {f.dangerText}
        </Alert>
      </Specimen>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <p className="border-b border-border px-5 py-3 text-xs font-semibold text-ink-3">{f.empty}</p>
          <EmptyState
            icon={Package}
            title={f.emptyTitle}
            description={f.emptyText}
            action={<Button onClick={() => toast.info(f.emptyAction)}>{f.emptyAction}</Button>}
          />
        </Panel>
        <Panel>
          <p className="border-b border-border px-5 py-3 text-xs font-semibold text-ink-3">{f.error}</p>
          <ErrorState onRetry={() => toast.info(ar.common.retry)} />
        </Panel>
      </div>
      <Specimen label={f.locked} stack>
        <LockedNotice title={f.lockedTitle} description={f.lockedText} action={<Button variant="brand" size="sm">{f.lockedAction}</Button>} />
      </Specimen>
      <Specimen label={f.loading} stack>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Specimen>
    </ShowSection>
  );
}
