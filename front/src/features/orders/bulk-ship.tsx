"use client";

import { Printer, Truck } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Alert, toast } from "@/components/ui/feedback";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { labelsUrl, shipBulk, type BulkResult } from "@/features/shipping/carriers-api";
import { errorMessage } from "@/lib/api/errors";
import { ar } from "@/messages/ar";

const t = ar.carriers.bulk;

/** Orders sent ten at a time (the server's limit), with progress, then who didn't go and why. */
const STEP = 10;

/** «اشحن المحدد»: every selected order through its own company's connected carrier. */
export function BulkShipDialog({ open, ids, onOpenChange, onDone }: { open: boolean; ids: number[]; onOpenChange: (o: boolean) => void; onDone: () => Promise<unknown> }) {
  const [done, setDone] = React.useState(0);
  const [results, setResults] = React.useState<BulkResult[] | null>(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function close(o: boolean) {
    if (running) return;
    if (!o) {
      setResults(null);
      setDone(0);
      setError(null);
    }
    onOpenChange(o);
  }

  async function start() {
    setRunning(true);
    setError(null);
    const all: BulkResult[] = [];
    try {
      for (let i = 0; i < ids.length; i += STEP) {
        all.push(...(await shipBulk(ids.slice(i, i + STEP))));
        setDone(Math.min(ids.length, i + STEP));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setResults(all);
      setRunning(false);
      const ok = all.filter((r) => r.ok).length;
      if (ok > 0) toast.success(t.result(ok, all.length - ok));
      await onDone();
    }
  }

  const shipped = (results ?? []).filter((r) => r.ok);
  const failed = (results ?? []).filter((r) => !r.ok);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="md">
        <DialogHeader title={t.title} description={results ? t.result(shipped.length, failed.length) : t.confirm(ids.length)} />
        <DialogBody className="flex flex-col gap-3">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {running ? (
            <div className="flex flex-col gap-2" role="status">
              <p className="text-sm text-ink-2">{t.progress(done, ids.length)}</p>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-brand transition-all" style={{ width: `${Math.round((done / Math.max(1, ids.length)) * 100)}%` }} />
              </div>
            </div>
          ) : null}
          {failed.length > 0 ? (
            <div>
              <p className="mb-1.5 text-sm font-semibold">{t.failedTitle}</p>
              <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto text-sm">
                {failed.map((r) => (
                  <li key={r.order_id} className="rounded-md bg-danger-soft/50 px-2.5 py-1.5">
                    <span className="font-semibold">#{r.order_number}</span> <span className="text-ink-2">{r.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          {results ? (
            <>
              <Button variant="ghost" onClick={() => close(false)}>
                {ar.common.close}
              </Button>
              {shipped.length > 0 ? (
                <Button asChild>
                  <a href={labelsUrl({ orderIds: shipped.slice(0, 50).map((r) => r.order_id) })} target="_blank" rel="noopener">
                    <Printer />
                    {t.printShipped}
                  </a>
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button variant="ghost" disabled={running} onClick={() => close(false)}>
                {ar.common.cancel}
              </Button>
              <Button loading={running} onClick={() => void start()}>
                <Truck />
                {t.start}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
