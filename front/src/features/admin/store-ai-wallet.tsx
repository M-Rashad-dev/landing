"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { RadioCards } from "@/components/ui/choice";
import { ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { adjustStoreAiWallet, storeAiWalletKey, useStoreAiWallet } from "./ai-api";
import { useDialog } from "./store-dialogs";

const t = ar.admin.store.aiWallet;
const types = ar.settings.aiWallet.types;

/** The store page's AI balance: free and paid pots, the last moves, and the owner's gift or deduction. */
export function AiWalletPanel({ storeId }: { storeId: number }) {
  const query = useStoreAiWallet(storeId);
  const adjust = useDialog();

  return (
    <Panel>
      <PanelHeader
        title={t.title}
        actions={
          <Button size="sm" variant="ghost" onClick={adjust.show}>
            <Wallet />
            {t.adjust}
          </Button>
        }
      />
      <PanelBody>
        {query.isPending ? (
          <Skeleton className="h-20" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="tabular text-2xl font-bold">{formatMoney(query.data.balance)}</p>
            <p className="text-[13px] text-ink-2">
              {t.split(formatMoney(query.data.free), formatMoney(query.data.paid))}
              {query.data.paid_allowed ? null : <span className="block text-ink-3">{t.paidLocked}</span>}
            </p>
            {query.data.entries.length === 0 ? (
              <p className="text-[13px] text-ink-3">{t.empty}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-[13px]">
                {query.data.entries.slice(0, 8).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="min-w-0">
                      <span className="block truncate">{e.description || types[e.type] || e.type}</span>
                      <span className="text-xs text-ink-3">{formatDateTime(e.created_at)}</span>
                    </span>
                    <span dir="ltr" className={cn("tabular shrink-0 font-semibold", e.amount >= 0 ? "text-success" : "text-ink")}>
                      {e.amount >= 0 ? "+" : "−"}
                      {formatMoney(Math.abs(e.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </PanelBody>
      <AdjustDialog storeId={storeId} open={adjust.open} onOpenChange={adjust.onOpenChange} />
    </Panel>
  );
}

const schema = z.object({
  action: z.enum(["gift", "deduct"]),
  amount: z.number({ error: t.amountInvalid }).min(0.01, t.amountInvalid).max(100000, t.amountInvalid),
  reason: z.string().trim().min(3, t.reasonRequired).max(300),
});
type Values = z.infer<typeof schema>;

function AdjustDialog({ storeId, open, onOpenChange }: { storeId: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const client = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { action: "gift", amount: Number.NaN, reason: "" } });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    try {
      const saved = await adjustStoreAiWallet(storeId, v);
      client.setQueryData(storeAiWalletKey(storeId), saved);
      toast.success(v.action === "gift" ? t.gifted : t.deducted);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={t.adjust} />
        <form onSubmit={submit} noValidate>
          <DialogBody className="flex flex-col gap-4">
            <Controller
              control={form.control}
              name="action"
              render={({ field }) => (
                <RadioCards
                  value={field.value}
                  onValueChange={field.onChange}
                  options={[
                    { value: "gift", title: t.gift, description: t.giftHint },
                    { value: "deduct", title: t.deduct, description: t.deductHint },
                  ]}
                />
              )}
            />
            <Field label={t.amount} htmlFor="ai-adjust-amount" error={errors.amount?.message} required>
              <Input id="ai-adjust-amount" type="number" inputMode="decimal" step="0.01" dir="ltr" className="tabular" {...form.register("amount", { setValueAs: (v: string) => (v === "" ? Number.NaN : Number(v)) })} />
            </Field>
            <Field label={t.reason} htmlFor="ai-adjust-reason" hint={t.reasonHint} error={errors.reason?.message} required>
              <Textarea id="ai-adjust-reason" rows={2} {...form.register("reason")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
