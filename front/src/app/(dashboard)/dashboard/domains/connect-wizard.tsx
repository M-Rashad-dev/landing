"use client";

import { AlertTriangle, CheckCircle2, Copy, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { addCustomDomain, normalizeHost, verifyDomain, type DnsInstructions, type Domain } from "@/lib/domains/api";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.domains;
const w = ar.domains.wizard;

/** Fast polling after the record is added: every 15 s for 5 minutes (the scheduler continues after that). */
export const POLL_MS = 15_000;
export const POLL_LIMIT_MS = 5 * 60_000;

async function copy(text: string) {
  await navigator.clipboard.writeText(text).catch(() => undefined);
  toast.success(ar.common.copied);
}

/** Step 1 → 3 dialog. Opened empty ("connect") or on an existing domain (DNS help / status). */
export function ConnectWizard({
  open,
  onOpenChange,
  initial,
  onChanged,
  onMakePrimary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Domain | null;
  onChanged: () => void;
  onMakePrimary: (domain: Domain) => Promise<void>;
}) {
  const [domain, setDomain] = useState<Domain | null>(initial);
  const [step, setStep] = useState(initial ? (initial.status === "active" ? 2 : 1) : 0);
  const [host, setHost] = useState("");
  const [hostError, setHostError] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const normalized = normalizeHost(host);

  async function submitHost(event: React.FormEvent) {
    event.preventDefault();
    setAdding(true);
    setHostError(undefined);
    try {
      const created = await addCustomDomain(host);
      setDomain(created);
      setStep(created.status === "active" ? 2 : 1);
      onChanged();
    } catch (err) {
      if (isApiError(err) && (err.isValidation || err.code === "limit_reached")) setHostError(err.errors.host?.[0] ?? err.message);
      else toast.error(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{w.title}</DialogTitle>
          <DialogDescription className="sr-only">{w.steps.join("، ")}</DialogDescription>
          <Stepper step={step} />
        </DialogHeader>

        {step === 0 ? (
          <form onSubmit={submitHost} className="contents">
            <DialogBody className="flex flex-col gap-4">
              <FormField label={w.hostLabel} htmlFor="d_host" error={hostError} hint={w.hostHint} required>
                <Input id="d_host" dir="ltr" autoFocus autoComplete="off" spellCheck={false} placeholder={w.hostPlaceholder} value={host} onChange={(e) => setHost(e.target.value)} />
              </FormField>
              {normalized && normalized !== host.trim() ? (
                <p className="text-sm text-muted-foreground">
                  {w.willAdd}{" "}
                  <span dir="ltr" className="font-semibold text-foreground">
                    {normalized}
                  </span>
                </p>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button type="submit" loading={adding} disabled={!normalized}>
                {w.add}
              </Button>
            </DialogFooter>
          </form>
        ) : null}

        {step === 1 && domain?.instructions ? (
          <>
            <DialogBody className="flex flex-col gap-4">
              <DnsInstructionsView instructions={domain.instructions} />
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => setStep(2)}>{ar.common.next}</Button>
            </DialogFooter>
          </>
        ) : null}

        {step === 2 && domain ? (
          <VerifyStep
            domain={domain}
            onDomain={(next) => {
              setDomain(next);
              onChanged();
            }}
            onBack={() => setStep(1)}
            onDone={() => onOpenChange(false)}
            onMakePrimary={onMakePrimary}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mt-3 flex items-center gap-2 text-xs">
      {w.steps.map((label, index) => (
        <li key={label} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border font-bold tabular-nums",
              index < step && "border-primary bg-primary text-primary-foreground",
              index === step && "border-primary text-primary",
              index > step && "text-muted-foreground",
            )}
          >
            {index + 1}
          </span>
          <span className={cn("truncate", index === step ? "font-semibold" : "text-muted-foreground")}>{label}</span>
          {index < w.steps.length - 1 ? <span className="h-px flex-1 bg-border" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

/** The one record to add, with copy buttons, provider tips and the Cloudflare warning. */
export function DnsInstructionsView({ instructions }: { instructions: DnsInstructions }) {
  const { record } = instructions;
  const rows: Array<[string, string]> = [
    [w.type, record.type],
    [w.name, record.name],
    [w.value, record.value],
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">{w.dnsIntro}</p>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row" className="w-28 bg-muted/50 sm:w-40 px-3 py-2.5 text-start font-medium text-muted-foreground">
                  {label}
                </th>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <code dir="ltr" className="break-all font-mono font-semibold">
                      {value}
                    </code>
                    <Button variant="ghost" size="icon-sm" aria-label={`${ar.common.copy} ${label}`} onClick={() => copy(value)}>
                      <Copy />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-muted-foreground">
        <li>{instructions.kind === "root" ? w.rootNote : w.subNote}</li>
        <li>{w.propagation}</li>
      </ul>
      <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {instructions.cloudflare_warning}
      </p>
      <details className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-semibold">{w.providers}</summary>
        <dl className="mt-3 flex flex-col gap-2">
          {w.providerTips.map((tip) => (
            <div key={tip.name}>
              <dt className="font-semibold">{tip.name}</dt>
              <dd className="text-muted-foreground">{tip.text}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

function VerifyStep({
  domain,
  onDomain,
  onBack,
  onDone,
  onMakePrimary,
}: {
  domain: Domain;
  onDomain: (domain: Domain) => void;
  onBack: () => void;
  onDone: () => void;
  onMakePrimary: (domain: Domain) => Promise<void>;
}) {
  const [checking, setChecking] = useState(false);
  const [polling, setPolling] = useState(domain.status !== "active");
  const [makingPrimary, setMakingPrimary] = useState(false);

  async function check(manual: boolean) {
    if (manual) setChecking(true);
    try {
      const next = await verifyDomain(domain.id);
      onDomain(next);
      if (next.status === "active") {
        setPolling(false);
        toast.success(t.activated);
      } else if (manual) {
        toast.info(t.notYet);
      }
    } catch (err) {
      if (manual) toast.error(errorMessage(err));
    } finally {
      if (manual) setChecking(false);
    }
  }
  const pollOnce = useEffectEvent(() => void check(false));

  useEffect(() => {
    if (!polling) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - started > POLL_LIMIT_MS) {
        window.clearInterval(timer);
        setPolling(false);
        return;
      }
      pollOnce();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [polling]);

  if (domain.status === "active") {
    return (
      <>
        <DialogBody className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 className="size-12 text-success" aria-hidden />
          <p dir="ltr" className="text-lg font-bold">
            {domain.host}
          </p>
          <p className="text-sm text-muted-foreground">{w.done}</p>
        </DialogBody>
        <DialogFooter>
          {!domain.is_primary ? (
            <Button
              variant="outline"
              loading={makingPrimary}
              onClick={async () => {
                setMakingPrimary(true);
                try {
                  await onMakePrimary(domain);
                  onDone();
                } finally {
                  setMakingPrimary(false);
                }
              }}
            >
              {w.makePrimaryNow}
            </Button>
          ) : null}
          <Button onClick={onDone}>{w.finish}</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogBody className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{w.checkText}</p>
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p dir="ltr" className="text-start font-bold">
            {domain.host}
          </p>
          <p className="flex items-center gap-2 text-sm">
            {polling ? <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> : null}
            {polling ? w.waiting : w.pollingStopped}
          </p>
          {domain.last_check_error ? <p className="text-sm text-destructive">{domain.last_check_error}</p> : null}
          {domain.last_checked_at ? (
            <p className="text-xs text-muted-foreground">
              {t.lastCheck(formatCairo(domain.last_checked_at))} · {t.attempts(domain.check_attempts)}
            </p>
          ) : null}
          {domain.status === "failed" ? <p className="text-xs text-muted-foreground">{t.failedHint}</p> : null}
        </div>
      </DialogBody>
      <DialogFooter>
        {domain.instructions ? (
          <Button variant="ghost" onClick={onBack}>
            {t.showDns}
          </Button>
        ) : null}
        <Button loading={checking} onClick={() => check(true)}>
          <RefreshCw />
          {t.verifyNow}
        </Button>
      </DialogFooter>
    </>
  );
}
