"use client";

import { Gift, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Pagination } from "@/components/data/data-table";
import { StatCard } from "@/components/data/stat-card";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { AI_ENTRY_TYPES, bonusFor, useAiWallet, useAiWalletEntries, type AiWallet } from "./ai-wallet-api";

const t = ar.settings.aiWallet;

/** Settings «رصيد الذكاء الاصطناعي»: what is left, topping up (through the billing checkout) and every move. */
export function AiWalletPage() {
  const query = useAiWallet();
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;

  const wallet = query.data;
  return (
    <div className="flex flex-col gap-4">
      <Balance wallet={wallet} />
      {wallet.pending ? (
        <Alert
          tone="info"
          action={
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/settings/billing/invoices/${wallet.pending.id}`}>{t.openInvoice}</Link>
            </Button>
          }
        >
          {t.pending(wallet.pending.number ?? "")}
        </Alert>
      ) : null}
      {wallet.paid_allowed ? (
        <TopUp wallet={wallet} />
      ) : (
        <Alert
          tone="warning"
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/settings/billing">{t.seePlans}</Link>
            </Button>
          }
        >
          {t.planLocked}
        </Alert>
      )}
      <History />
    </div>
  );
}

function Balance({ wallet }: { wallet: AiWallet }) {
  const low = wallet.spendable <= wallet.low_balance;
  return (
    <>
      {wallet.spendable <= 0 ? <Alert tone="danger">{t.empty}</Alert> : low ? <Alert tone="warning">{t.low(formatMoney(wallet.spendable))}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t.balance} value={formatMoney(wallet.balance)} attention={low} />
        <StatCard label={t.free} value={formatMoney(wallet.free)} hint={t.freeHint} />
        <StatCard label={t.paid} value={formatMoney(wallet.paid)} hint={wallet.paid_allowed || wallet.paid <= 0 ? t.paidHint : t.paidLocked} />
      </div>
      {wallet.month.spent > 0 ? (
        <p className="text-sm text-ink-2">
          {t.monthSpent}: <span className="tabular font-semibold text-ink">{formatMoney(wallet.month.spent)}</span>
        </p>
      ) : null}
    </>
  );
}

function TopUp({ wallet }: { wallet: AiWallet }) {
  const router = useRouter();
  const [amount, setAmount] = React.useState<number>(wallet.packages[0] ?? wallet.min);
  const [custom, setCustom] = React.useState("");
  const chosen = custom.trim() === "" ? amount : Number(custom);
  const valid = Number.isInteger(chosen) && chosen > 0 && (wallet.packages.includes(chosen) || chosen >= wallet.min);
  const bonus = valid ? bonusFor(wallet.offers, chosen) : 0;
  const blocked = wallet.pending?.status === "pending_review";

  return (
    <Panel>
      <PanelHeader title={t.topup} description={t.topupHint} />
      <PanelBody className="flex flex-col gap-4">
        <div role="radiogroup" aria-label={t.topup} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {wallet.packages.map((p) => {
            const on = custom.trim() === "" && amount === p;
            const gift = bonusFor(wallet.offers, p);
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setAmount(p);
                  setCustom("");
                }}
                className={cn("flex flex-col items-center gap-1 rounded-xl border px-3 py-3 transition-colors", on ? "border-brand bg-brand-soft" : "border-border hover:border-border-strong")}
              >
                <span className="tabular text-lg font-bold">{formatMoney(p)}</span>
                {gift > 0 ? <span className="text-xs font-semibold text-success">+ {formatMoney(gift)}</span> : null}
              </button>
            );
          })}
        </div>
        <Field label={t.custom} htmlFor="ai-custom" hint={t.customHint(formatMoney(wallet.min))} error={custom.trim() !== "" && !valid ? t.belowMin(formatMoney(wallet.min)) : undefined} optional>
          <Input id="ai-custom" type="number" inputMode="numeric" dir="ltr" className="tabular max-w-48" min={wallet.min} value={custom} onChange={(e) => setCustom(e.target.value)} />
        </Field>
        {wallet.offers.length > 0 ? (
          <div className="flex flex-col gap-1.5 rounded-lg bg-surface-2 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <Gift className="size-4 text-success" aria-hidden />
              {t.offers}
            </p>
            {wallet.offers.map((o) => (
              <p key={o.min} className="text-ink-2">
                {t.offer(formatMoney(o.min), formatMoney(o.bonus))}
              </p>
            ))}
          </div>
        ) : null}
        {valid ? (
          <p className="text-sm">
            {t.youGet(formatMoney(chosen + bonus))}
            {bonus > 0 ? <span className="text-success"> · {t.withBonus(formatMoney(bonus))}</span> : null}
          </p>
        ) : null}
        {blocked ? <Alert tone="info">{t.pendingBlocks}</Alert> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!valid || blocked} onClick={() => router.push(`/dashboard/settings/billing/checkout?ai=${chosen}`)}>
            <Wallet />
            {t.pay}
          </Button>
          <p className="text-xs text-ink-3">{t.noRefund}</p>
        </div>
      </PanelBody>
    </Panel>
  );
}

function History() {
  const [type, setType] = React.useState("");
  const [page, setPage] = React.useState(1);
  const query = useAiWalletEntries(type, page);
  const rows = query.data?.data;

  return (
    <Panel>
      <PanelHeader
        title={t.history}
        actions={
          <Select
            className="w-44"
            value={type}
            emptyLabel={t.allTypes}
            onValueChange={(v) => {
              setType(v);
              setPage(1);
            }}
            options={AI_ENTRY_TYPES.map((k) => ({ value: k, label: t.types[k] ?? k }))}
          />
        }
      />
      <PanelBody>
        {query.isPending ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
        ) : !rows?.length ? (
          <EmptyState compact icon={Sparkles} title={t.noEntries} description={t.noEntriesHint} />
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-border">
              {rows.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.description || t.types[e.type]}</p>
                    <p className="text-xs text-ink-3">
                      {t.types[e.type]} · {formatDateTime(e.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className={cn("tabular font-semibold", e.amount >= 0 ? "text-success" : "text-ink")} dir="ltr">
                      {e.amount >= 0 ? "+" : "−"}
                      {formatMoney(Math.abs(e.amount))}
                    </p>
                    <p className="text-xs text-ink-3">{t.after(formatMoney(e.balance_after))}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={setPage} />
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
