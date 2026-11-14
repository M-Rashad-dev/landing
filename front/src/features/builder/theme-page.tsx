"use client";

import { ExternalLink, Lock, Paintbrush, Sparkles } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, LockedNotice, Skeleton } from "@/components/ui/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useStore } from "@/features/store/store-page";
import { errorMessage } from "@/lib/api/errors";
import { usePlanFeature } from "@/lib/auth/session-context";
import { formatDateTime } from "@/lib/format";
import { ar } from "@/messages/ar";

const t = ar.design.page;

/** Screenshots of the themes (front/public/themes). */
const SHOTS: Record<string, string> = { asas: "/themes/asas.png" };

export function ThemePage() {
  const allowed = usePlanFeature("store");
  const query = useStore();

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {!allowed ? (
        <LockedNotice
          title={t.needsStore}
          description={t.needsStoreText}
          action={
            <Button asChild size="sm">
              <Link href="/dashboard/settings/billing">{t.upgrade}</Link>
            </Button>
          }
        />
      ) : query.isPending ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title={t.mine} />
            <PanelBody>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(query.data.exists ? query.data.themes : [{ key: "asas", name: "أساس", short_description: null, active: true, free: true }]).map((theme) => {
                  const design = query.data.exists ? query.data.design : null;
                  return (
                    <article key={theme.key} className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                      <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-surface-2">
                        {SHOTS[theme.key] ? (
                          // eslint-disable-next-line @next/next/no-img-element -- static screenshot
                          <img src={SHOTS[theme.key]} alt={theme.name} className="size-full object-cover object-top" />
                        ) : null}
                        {theme.active ? (
                          <Badge tone="success" className="absolute start-3 top-3" dot>
                            {t.active}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <p className="flex items-center gap-2 text-lg font-bold">
                          {theme.name}
                          {theme.free ? <Badge size="sm">{t.free}</Badge> : null}
                        </p>
                        {theme.short_description ? <p className="text-sm text-ink-2">{theme.short_description}</p> : null}
                        {theme.active ? (
                          <p className="text-xs text-ink-3">
                            {design?.published_at ? t.published(formatDateTime(design.published_at)) : t.neverPublished}
                            {design?.has_unpublished_changes && design.published_at ? ` · ${t.unpublished}` : ""}
                          </p>
                        ) : null}
                        <div className="mt-auto flex flex-wrap gap-2 pt-2">
                          <Button asChild>
                            <Link href="/dashboard/design/builder">
                              <Paintbrush />
                              {t.customize}
                            </Link>
                          </Button>
                          <Button asChild variant="outline">
                            <Link href="/dashboard/design/preview" target="_blank">
                              <ExternalLink />
                              {t.preview}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title={t.paid} />
            <PanelBody className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                <Sparkles className="size-6" />
              </span>
              <Badge>
                <Lock />
                {ar.common.soon}
              </Badge>
              <p className="max-w-md text-sm text-ink-2">{t.paidSoon}</p>
            </PanelBody>
          </Panel>
        </div>
      )}
    </>
  );
}
