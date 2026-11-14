"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, Globe, Lock, RefreshCw, ShieldCheck, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, ErrorState, LockedNotice, Skeleton, toast } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { api, apiPage } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { ar } from "@/messages/ar";

const t = ar.settings.domains;

type Domain = {
  id: number;
  host: string;
  type: "subdomain" | "custom";
  status: "pending" | "active" | "failed";
  locked_by_plan: boolean;
  is_primary: boolean;
  verified_at: string | null;
  last_checked_at: string | null;
  last_check_error: string | null;
  ssl_status: "pending" | "issued" | "unknown";
  instructions: { kind: "root" | "subdomain"; zone: string; record: { type: string; name: string; value: string }; cloudflare_warning: string } | null;
};

export function DomainsPage() {
  const query = useQuery({
    queryKey: ["domains"],
    queryFn: async () => {
      const page = await apiPage<Domain>("/dashboard/domains");
      return { domains: page.data, platform: String(page.meta.platform_domain ?? ""), limit: page.meta.custom_limit as number | null };
    },
  });

  if (query.isPending) return <Skeleton className="h-64 rounded-xl" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;

  const sub = query.data.domains.find((d) => d.type === "subdomain");
  const custom = query.data.domains.filter((d) => d.type === "custom");

  return (
    <div className="grid max-w-3xl gap-4">
      <p className="text-sm text-ink-2">{t.description}</p>
      {sub ? <FreeLink domain={sub} platform={query.data.platform} /> : null}
      <Custom domains={custom} limit={query.data.limit} />
    </div>
  );
}

function useRefresh() {
  const client = useQueryClient();
  const router = useRouter();
  return async () => {
    await client.invalidateQueries({ queryKey: ["domains"] });
    await client.invalidateQueries({ queryKey: ["home"] });
    router.refresh();
  };
}

function FreeLink({ domain, platform }: { domain: Domain; platform: string }) {
  const refresh = useRefresh();
  const current = domain.host.slice(0, -(platform.length + 1));
  const [label, setLabel] = React.useState(current);
  const [check, setCheck] = React.useState<{ available: boolean; reason: string | null } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const clean = label.trim().toLowerCase();
  const dirty = clean !== current;

  React.useEffect(() => {
    if (!dirty || clean.length < 3) return;
    const id = window.setTimeout(async () => {
      try {
        setCheck(await api<{ available: boolean; reason: string | null }>("/dashboard/domains/subdomain/availability", { query: { label: clean } }));
      } catch {
        setCheck(null);
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [clean, dirty]);

  async function save() {
    setBusy(true);
    try {
      await api("/dashboard/domains/subdomain", { method: "PUT", body: { label: clean } });
      toast.success(t.saved);
      setCheck(null);
      await refresh();
    } catch (e) {
      toast.error(isApiError(e) && e.isValidation ? (Object.values(e.errors)[0]?.[0] ?? errorMessage(e)) : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader title={t.free} description={t.freeHint} />
      <PanelBody className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row" dir="ltr">
          <div className="flex flex-1 items-stretch">
            <Input value={label} onChange={(e) => setLabel(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))} maxLength={30} aria-label={t.free} className="rounded-e-none" />
            <span className="flex items-center rounded-e-lg border border-s-0 border-border-strong bg-surface-2 px-3 text-sm text-ink-3">.{platform}</span>
          </div>
          {dirty ? (
            <Button loading={busy} disabled={clean.length < 3 || check?.available === false} onClick={() => void save()}>
              {t.change}
            </Button>
          ) : null}
        </div>
        {dirty && check ? (
          <p className={check.available ? "text-sm text-success" : "text-sm text-danger"}>{check.available ? t.available : check.reason}</p>
        ) : !dirty ? (
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <CheckCircle2 className="size-3.5 text-success" />
            <span dir="ltr">{domain.host}</span>
            {domain.is_primary ? <Badge size="sm">{t.primary}</Badge> : null}
          </p>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function Custom({ domains, limit }: { domains: Domain[]; limit: number | null }) {
  const refresh = useRefresh();
  const [host, setHost] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const allowed = limit === null || limit > 0;
  const canAdd = allowed && (limit === null || domains.length < limit);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await api("/dashboard/domains/custom", { method: "POST", body: { host: host.trim().toLowerCase() } });
      toast.success(t.added);
      setHost("");
      await refresh();
    } catch (e) {
      setError(isApiError(e) && e.isValidation ? (e.errors.host?.[0] ?? errorMessage(e)) : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader title={t.custom} description={t.customHint} />
      <PanelBody className="flex flex-col gap-4">
        {!allowed ? (
          <LockedNotice
            title={t.noCustom}
            action={
              <Button asChild size="sm">
                <Link href="/dashboard/settings/billing">{ar.settings.store.upgrade}</Link>
              </Button>
            }
          />
        ) : null}
        {domains.map((d) => (
          <CustomDomain key={d.id} domain={d} />
        ))}
        {canAdd ? (
          <div className="flex flex-col gap-2">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input dir="ltr" value={host} onChange={(e) => setHost(e.target.value)} placeholder={t.hostPlaceholder} aria-label={t.custom} />
              <Button loading={busy} disabled={host.trim().length < 4} onClick={() => void add()}>
                <Globe />
                {t.add}
              </Button>
            </div>
          </div>
        ) : allowed ? (
          <p className="text-xs text-ink-3">{t.limitReached}</p>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function CustomDomain({ domain }: { domain: Domain }) {
  const refresh = useRefresh();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState(false);

  async function run(key: string, action: () => Promise<Domain | unknown>, done?: (d: Domain | undefined) => string) {
    setBusy(key);
    try {
      const result = (await action()) as Domain | undefined;
      if (done) {
        const message = done(result);
        if (message === t.notYet) toast.warning(message);
        else toast.success(message);
      }
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(ar.common.copied);
    } catch {
      toast.error(ar.errors.generic);
    }
  }

  const tone = domain.status === "active" ? "success" : domain.status === "failed" ? "danger" : "warning";
  const record = domain.instructions?.record;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span dir="ltr" className="font-semibold">
          {domain.host}
        </span>
        <Badge tone={tone} dot>
          {t.status[domain.status]}
        </Badge>
        {domain.status === "active" ? (
          <Badge tone={domain.ssl_status === "issued" ? "success" : "neutral"}>
            {domain.ssl_status === "issued" ? <Lock /> : <ShieldCheck />}
            {t.ssl[domain.ssl_status]}
          </Badge>
        ) : null}
        {domain.is_primary ? <Badge tone="brand-soft">{t.primary}</Badge> : null}
        <div className="ms-auto flex flex-wrap gap-1.5">
          {domain.status === "active" && !domain.is_primary ? (
            <Button
              size="sm"
              variant="ghost"
              loading={busy === "primary"}
              onClick={() =>
                void run(
                  "primary",
                  () => api(`/dashboard/domains/${domain.id}/make-primary`, { method: "POST" }),
                  () => t.primaryDone,
                )
              }
            >
              <Star />
              {t.makePrimary}
            </Button>
          ) : null}
          {domain.status === "active" && domain.ssl_status !== "issued" ? (
            <Button size="sm" variant="ghost" loading={busy === "ssl"} onClick={() => void run("ssl", () => api(`/dashboard/domains/${domain.id}/check-ssl`, { method: "POST" }))}>
              <RefreshCw />
              {t.checkSsl}
            </Button>
          ) : null}
          <Button size="icon-sm" variant="danger-ghost" aria-label={t.remove} onClick={() => setRemoving(true)}>
            <Trash2 />
          </Button>
        </div>
      </div>

      {domain.status !== "active" && domain.instructions && record ? (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <p className="font-medium">{t.steps}</p>
          <ol className="flex list-decimal flex-col gap-2 ps-5 text-ink-2">
            <li>{t.step1(domain.instructions.zone)}</li>
            <li>
              {t.step2}
              <div className="mt-2 grid gap-2 sm:grid-cols-3" dir="ltr">
                {[
                  { label: t.recordType, value: record.type },
                  { label: t.recordName, value: record.name },
                  { label: t.recordValue, value: record.value },
                ].map((cell) => (
                  <div key={cell.label} className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5">
                    <p className="text-end text-[11px] text-ink-3" dir="rtl">
                      {cell.label}
                    </p>
                    <p className="flex items-center justify-between gap-2 font-mono text-sm text-ink">
                      {cell.value}
                      <button type="button" className="text-ink-3 hover:text-ink" onClick={() => void copy(cell.value)} aria-label={`${t.copy} ${cell.label}`}>
                        <Copy className="size-3.5" />
                      </button>
                    </p>
                  </div>
                ))}
              </div>
            </li>
            <li>{t.step3}</li>
          </ol>
          <p className="text-xs text-ink-3">{domain.instructions.cloudflare_warning}</p>
          {domain.last_check_error ? <p className="text-xs text-danger">{t.lastError(domain.last_check_error)}</p> : null}
          {domain.last_checked_at ? <p className="text-xs text-ink-3">{formatDateTime(domain.last_checked_at)}</p> : null}
          <Button
            className="self-start"
            loading={busy === "verify"}
            onClick={() =>
              void run(
                "verify",
                () => api<Domain>(`/dashboard/domains/${domain.id}/verify`, { method: "POST" }),
                (d) => (d?.status === "active" ? t.verified : t.notYet),
              )
            }
          >
            <RefreshCw />
            {t.verify}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={t.removeTitle(domain.host)}
        description={t.removeText}
        confirmLabel={t.remove}
        destructive
        loading={busy === "remove"}
        onConfirm={() =>
          void run(
            "remove",
            () => api(`/dashboard/domains/${domain.id}`, { method: "DELETE" }),
            () => t.removed,
          ).then(() => setRemoving(false))
        }
      />
    </div>
  );
}
