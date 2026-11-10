"use client";

import { PlanLockedBadge } from "@/components/billing/plan";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, ExternalLink, Globe, Info, Loader2, Pencil, Plus, RefreshCw, ShieldCheck, Star, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { useSiteUrl } from "@/components/dashboard/session-context";
import { FormField } from "@/components/forms/form-field";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import {
  checkDomainSsl,
  deleteDomain,
  domainKeys,
  isValidLabel,
  labelOf,
  makeDomainPrimary,
  renameSubdomain,
  subdomainAvailability,
  useDomains,
  verifyDomain,
  type Availability,
  type Domain,
  type DomainStatus,
  type SslStatus,
} from "@/lib/domains/api";
import { ar } from "@/messages/ar";
import { ConnectWizard } from "./connect-wizard";

const t = ar.domains;

const STATUS_VARIANT: Record<DomainStatus, BadgeVariant> = { pending: "warning", active: "success", failed: "destructive" };
const SSL_VARIANT: Record<SslStatus, BadgeVariant> = { pending: "secondary", issued: "success", unknown: "warning" };

async function copy(text: string) {
  await navigator.clipboard.writeText(text).catch(() => undefined);
  toast.success(ar.common.copied);
}

export function DomainsManager() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useDomains();
  const [wizard, setWizard] = useState<{ key: number; domain: Domain | null } | null>(null);
  const [removing, setRemoving] = useState<Domain | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  /** Refresh the list and the server session (primary host → page links everywhere). */
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: domainKeys.all });
    router.refresh();
  };

  async function run(key: string, action: () => Promise<unknown>, success?: string) {
    setBusy(key);
    try {
      await action();
      if (success) toast.success(success);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const makePrimary = (domain: Domain) => run(`primary-${domain.id}`, () => makeDomainPrimary(domain.id), t.madePrimary);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) return <DomainsSkeleton />;

  const subdomain = data.domains.find((d) => d.type === "subdomain");
  const custom = data.domains.filter((d) => d.type === "custom");

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {t.redirectNote}
      </p>

      {subdomain ? <SubdomainCard domain={subdomain} platformDomain={data.meta.platform_domain} onRenamed={refresh} onMakePrimary={makePrimary} busy={busy === `primary-${subdomain.id}`} /> : null}

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">{t.custom}</h2>
            <p className="text-sm text-muted-foreground">{t.customText(custom.length, data.meta.custom_limit)}</p>
          </div>
          <Button onClick={() => setWizard({ key: Date.now(), domain: null })} disabled={custom.length >= data.meta.custom_limit}>
            <Plus />
            {t.connect}
          </Button>
        </div>

        {custom.length === 0 ? (
          <EmptyState icon={Globe} title={t.emptyTitle} description={t.emptyText} className="border-0 py-8" />
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {custom.map((domain) => (
              <CustomDomainRow
                key={domain.id}
                domain={domain}
                busy={busy}
                onVerify={() =>
                  run(`verify-${domain.id}`, async () => {
                    const next = await verifyDomain(domain.id);
                    if (next.status === "active") toast.success(t.activated);
                    else toast.info(next.last_check_error ?? t.notYet);
                  })
                }
                onCheckSsl={() => run(`ssl-${domain.id}`, () => checkDomainSsl(domain.id), t.sslChecking)}
                onMakePrimary={() => makePrimary(domain)}
                onShowDns={() => setWizard({ key: Date.now(), domain })}
                onRemove={() => setRemoving(domain)}
              />
            ))}
          </ul>
        )}
      </Card>

      {wizard ? (
        <ConnectWizard
          key={wizard.key}
          open
          initial={wizard.domain}
          onOpenChange={(open) => !open && setWizard(null)}
          onChanged={() => void queryClient.invalidateQueries({ queryKey: domainKeys.all })}
          onMakePrimary={makePrimary}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? t.removeConfirm(removing.host) : ""}
        description={t.removeText}
        confirmLabel={t.remove}
        destructive
        loading={busy === "remove"}
        onConfirm={() =>
          removing &&
          run(
            "remove",
            async () => {
              await deleteDomain(removing.id);
              setRemoving(null);
            },
            t.removed,
          )
        }
      />
    </div>
  );
}

function SubdomainCard({
  domain,
  platformDomain,
  onRenamed,
  onMakePrimary,
  busy,
}: {
  domain: Domain;
  platformDomain: string;
  onRenamed: () => Promise<void>;
  onMakePrimary: (domain: Domain) => Promise<void>;
  busy: boolean;
}) {
  const toSite = useSiteUrl();
  const url = toSite(domain.host);
  const [renaming, setRenaming] = useState(false);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            {t.free}
            {domain.is_primary ? <PrimaryBadge /> : null}
          </h2>
          <p className="text-sm text-muted-foreground">{t.freeText}</p>
        </div>
        <Button variant="outline" onClick={() => setRenaming(true)}>
          <Pencil />
          {t.rename}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
        <a href={url} target="_blank" rel="noreferrer" dir="ltr" className="min-w-0 flex-1 truncate font-semibold text-primary hover:underline">
          {url}
        </a>
        <Button variant="ghost" size="icon-sm" aria-label={ar.common.copy} onClick={() => copy(url)}>
          <Copy />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={ar.common.open} asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink />
          </a>
        </Button>
        {!domain.is_primary ? (
          <Button variant="outline" size="sm" loading={busy} onClick={() => onMakePrimary(domain)}>
            <Star />
            {t.makePrimary}
          </Button>
        ) : null}
      </div>
      {renaming ? (
        <RenameDialog
          current={labelOf(domain.host, platformDomain)}
          platformDomain={platformDomain}
          onClose={() => setRenaming(false)}
          onRenamed={async () => {
            setRenaming(false);
            toast.success(t.renamed);
            await onRenamed();
          }}
        />
      ) : null}
    </Card>
  );
}

function RenameDialog({ current, platformDomain, onClose, onRenamed }: { current: string; platformDomain: string; onClose: () => void; onRenamed: () => Promise<void> }) {
  const [label, setLabel] = useState(current);
  const [result, setResult] = useState<Availability | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();
  const clean = label.trim().toLowerCase();
  const formatError = clean && !isValidLabel(clean) ? t.renameHint : undefined;
  const checkable = clean !== current && !formatError && clean !== "";
  const checked = checkable && result?.label === clean ? result : null;

  // Debounced availability check; stale answers are ignored by comparing the label.
  useEffect(() => {
    if (!checkable) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      subdomainAvailability(clean, controller.signal)
        .then(setResult)
        .catch(() => undefined);
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [clean, checkable]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setServerError(undefined);
    try {
      await renameSubdomain(clean);
      await onRenamed();
    } catch (err) {
      if (isApiError(err) && err.isValidation) setServerError(err.errors.label?.[0] ?? err.message);
      else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const error = serverError ?? formatError ?? (checked && !checked.available ? (checked.reason ?? undefined) : undefined);

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <form onSubmit={save} className="contents">
          <DialogHeader>
            <DialogTitle>{t.renameTitle}</DialogTitle>
            <DialogDescription>{t.renameWarning}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <FormField label={t.label} htmlFor="sub_label" error={error} hint={error ? undefined : t.renameHint} required>
              <div dir="ltr" className="flex items-center gap-2">
                <Input
                  id="sub_label"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={30}
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    setServerError(undefined);
                  }}
                />
                <span className="shrink-0 text-sm text-muted-foreground">.{platformDomain}</span>
              </div>
            </FormField>
            <p dir="ltr" className="text-start text-sm font-semibold">
              {clean || "…"}.{platformDomain}
            </p>
            {checkable && !error ? (
              <p className="flex items-center gap-1.5 text-sm" aria-live="polite">
                {checked ? (
                  <>
                    <CheckCircle2 className="size-4 text-success" aria-hidden />
                    <span className="text-success">{t.available}</span>
                  </>
                ) : (
                  <>
                    <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
                    <span className="text-muted-foreground">{t.checking}</span>
                  </>
                )}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" loading={saving} disabled={!checked?.available}>
              {ar.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CustomDomainRow({
  domain,
  busy,
  onVerify,
  onCheckSsl,
  onMakePrimary,
  onShowDns,
  onRemove,
}: {
  domain: Domain;
  busy: string | null;
  onVerify: () => void;
  onCheckSsl: () => void;
  onMakePrimary: () => void;
  onShowDns: () => void;
  onRemove: () => void;
}) {
  const toSite = useSiteUrl();
  const active = domain.status === "active";

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {active ? (
          <a href={toSite(domain.host)} target="_blank" rel="noreferrer" dir="ltr" className="font-bold hover:underline">
            {domain.host}
          </a>
        ) : (
          <span dir="ltr" className="font-bold">
            {domain.host}
          </span>
        )}
        {domain.is_primary ? <PrimaryBadge /> : null}
        <PlanLockedBadge locked={domain.locked_by_plan} />
        <Badge variant={STATUS_VARIANT[domain.status]}>
          {domain.status === "active" ? <CheckCircle2 className="size-3" aria-hidden /> : domain.status === "failed" ? <XCircle className="size-3" aria-hidden /> : null}
          {t.statuses[domain.status]}
        </Badge>
        {active ? (
          <Badge variant={SSL_VARIANT[domain.ssl_status]}>
            <ShieldCheck className="size-3" aria-hidden />
            {t.ssl[domain.ssl_status]}
          </Badge>
        ) : null}
      </div>

      {!active ? (
        <div className="flex flex-col gap-1 text-sm">
          {domain.last_check_error ? <p className="text-destructive">{domain.last_check_error}</p> : null}
          <p className="text-xs text-muted-foreground">
            {domain.last_checked_at ? t.lastCheck(formatCairo(domain.last_checked_at)) : null}
            {domain.check_attempts > 0 ? ` · ${t.attempts(domain.check_attempts)}` : null}
          </p>
          {domain.status === "failed" ? <p className="text-xs text-muted-foreground">{t.failedHint}</p> : null}
        </div>
      ) : domain.ssl_status === "unknown" ? (
        <p className="text-xs text-muted-foreground">{t.sslUnknownHint}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!active ? (
          <>
            <Button size="sm" loading={busy === `verify-${domain.id}`} onClick={onVerify}>
              <RefreshCw />
              {t.verifyNow}
            </Button>
            <Button size="sm" variant="outline" onClick={onShowDns}>
              {t.showDns}
            </Button>
          </>
        ) : null}
        {active && domain.ssl_status === "unknown" ? (
          <Button size="sm" variant="outline" loading={busy === `ssl-${domain.id}`} onClick={onCheckSsl}>
            <ShieldCheck />
            {t.checkSsl}
          </Button>
        ) : null}
        {active && !domain.is_primary ? (
          <Button size="sm" variant="outline" loading={busy === `primary-${domain.id}`} onClick={onMakePrimary}>
            <Star />
            {t.makePrimary}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" className="ms-auto text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 />
          {ar.common.delete}
        </Button>
      </div>
    </li>
  );
}

function PrimaryBadge() {
  return (
    <Badge>
      <Star className="size-3" aria-hidden />
      {t.primary}
    </Badge>
  );
}

function DomainsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-12 rounded-lg" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}
