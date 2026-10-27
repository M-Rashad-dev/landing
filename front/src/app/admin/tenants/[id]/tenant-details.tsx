"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Copy, ExternalLink, KeyRound, PauseCircle, PlayCircle, Star } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { ErrorState } from "@/components/dashboard/error-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { useSiteUrl } from "@/components/dashboard/session-context";
import { FormField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { activateTenant, adminKeys, resetTenantPassword, suspendTenant, useAdminTenant, type AdminTenantDetail } from "@/lib/admin/api";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { formatNumber } from "@/lib/format/number";
import { formatPhoneLocal } from "@/lib/format/phone";
import { ar } from "@/messages/ar";
import { TenantStatusBadge } from "../tenants-manager";

const t = ar.admin.tenant;

export function TenantDetails({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const toSite = useSiteUrl();
  const { data, isPending, isError, error, refetch } = useAdminTenant(id);
  const [suspending, setSuspending] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const store = (tenant: AdminTenantDetail) => {
    queryClient.setQueryData(adminKeys.tenant(id), tenant);
    void queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
    void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
  };

  async function activate() {
    setBusy(true);
    try {
      store(await activateTenant(id));
      toast.success(t.activated);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      const result = await resetTenantPassword(id);
      setConfirmReset(false);
      setPassword(result.temporary_password);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  const site = toSite(data.primary_host);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/tenants" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" aria-hidden />
        {t.back}
      </Link>

      <PageHeader
        className="mb-0"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {data.name}
            <TenantStatusBadge status={data.status} />
          </span>
        }
        actions={
          <>
            {site ? (
              <Button variant="outline" asChild>
                <a href={site} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  {t.openSite}
                </a>
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setConfirmReset(true)} disabled={!data.owner}>
              <KeyRound />
              {t.resetPassword}
            </Button>
            {data.status === "active" ? (
              <Button variant="destructive" onClick={() => setSuspending(true)}>
                <PauseCircle />
                {t.suspend}
              </Button>
            ) : (
              <Button loading={busy} onClick={activate}>
                <PlayCircle />
                {t.activate}
              </Button>
            )}
          </>
        }
      />

      {data.status === "suspended" ? (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>
            <span className="font-semibold">{t.reason}:</span> {data.suspended_reason ?? "—"} · {t.suspendedAt}: {formatCairo(data.suspended_at)}
          </span>
        </p>
      ) : null}

      <Card className="p-5">
        <h2 className="mb-4 font-bold">{t.info}</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label={ar.admin.tenants.owner}>{data.owner?.name ?? "—"}</Info>
          <Info label={t.email}>
            <span dir="ltr">{data.owner?.email ?? "—"}</span>
          </Info>
          <Info label={ar.admin.tenants.phone}>
            <span dir="ltr" className="tabular-nums">
              {data.owner ? formatPhoneLocal(data.owner.phone) : "—"}
            </span>
          </Info>
          <Info label={ar.admin.tenants.registered}>{formatCairo(data.created_at)}</Info>
          <Info label={t.lastLogin}>{data.owner?.last_login_at ? formatCairo(data.owner.last_login_at) : t.never}</Info>
          <Info label={ar.admin.tenants.pages}>{t.published(data.published_pages_count, data.pages_count)}</Info>
          <Info label={ar.admin.tenants.orders}>{formatNumber(data.orders_count)}</Info>
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-bold">{t.domains}</h2>
        <ul className="divide-y">
          {data.domains.map((domain) => (
            <li key={domain.id} className="flex flex-wrap items-center gap-2 py-3">
              <span dir="ltr" className="font-semibold">
                {domain.host}
              </span>
              {domain.is_primary ? (
                <Badge>
                  <Star className="size-3" aria-hidden />
                  {ar.domains.primary}
                </Badge>
              ) : null}
              <Badge variant={domain.status === "active" ? "success" : domain.status === "failed" ? "destructive" : "warning"}>{ar.domains.statuses[domain.status]}</Badge>
              {domain.type === "custom" && domain.status === "active" ? <Badge variant="secondary">{ar.domains.ssl[domain.ssl_status]}</Badge> : null}
            </li>
          ))}
        </ul>
      </Card>

      {suspending ? <SuspendDialog id={id} onClose={() => setSuspending(false)} onDone={store} /> : null}

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t.resetTitle}
        description={t.resetText}
        confirmLabel={t.resetConfirm}
        loading={busy}
        onConfirm={reset}
      />

      <Dialog open={password !== null} onOpenChange={(open) => !open && setPassword(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t.temporaryTitle}</DialogTitle>
            <DialogDescription>{t.temporaryWarning}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
              <code dir="ltr" className="flex-1 select-all break-all font-mono text-lg font-bold">
                {password}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={ar.common.copy}
                onClick={async () => {
                  await navigator.clipboard.writeText(password ?? "").catch(() => undefined);
                  toast.success(ar.common.copied);
                }}
              >
                <Copy />
              </Button>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setPassword(null)}>{ar.common.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{children}</dd>
    </div>
  );
}

function SuspendDialog({ id, onClose, onDone }: { id: number; onClose: () => void; onDone: (tenant: AdminTenantDetail) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      onDone(await suspendTenant(id, reason));
      toast.success(t.suspended);
      onClose();
    } catch (err) {
      if (isApiError(err) && err.isValidation) setError(err.errors.reason?.[0] ?? err.message);
      else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{t.suspendTitle}</DialogTitle>
            <DialogDescription>{t.suspendText}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label={t.reasonLabel} htmlFor="suspend_reason" error={error} required>
              <Textarea id="suspend_reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="destructive" loading={saving} disabled={reason.trim().length < 3}>
              {t.suspend}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
