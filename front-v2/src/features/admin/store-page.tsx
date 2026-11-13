"use client";

import { Ban, CalendarPlus, ExternalLink, Gift, KeyRound, MessageCircle, MoreHorizontal, Plus, Power, Trash2 } from "lucide-react";
import * as React from "react";
import { DescriptionList, Timeline } from "@/components/data/details";
import { Meter, StatCard } from "@/components/data/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { whatsappLink } from "@/features/orders/api";
import { errorMessage } from "@/lib/api/errors";
import { formatDateTime, formatMoney, formatNumber, formatPhone } from "@/lib/format";
import { ar } from "@/messages/ar";
import {
  activateStore,
  deleteOverride,
  resetOwnerPassword,
  revokeTheme,
  useActivity,
  useRefreshStore,
  useStore,
  useStoreBilling,
  useStoreThemes,
  type StoreDetail,
} from "./api";
import { entitlementLabel, ExtendDialog, GrantPlanDialog, GrantThemeDialog, OverrideDialog, PasswordResultDialog, SuspendDialog, useDialog } from "./store-dialogs";
import { PlanCell } from "./stores-page";

const t = ar.admin.store;
const day = (iso: string | null | undefined) => formatDateTime(iso).slice(0, 10);

export function StorePage({ id }: { id: number }) {
  const query = useStore(id);
  const refresh = useRefreshStore(id);
  const suspend = useDialog();
  const [confirm, setConfirm] = React.useState<"activate" | "password" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [password, setPassword] = React.useState<string | null>(null);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  const s = query.data;
  const suspended = s.status === "suspended";

  async function confirmAction() {
    setBusy(true);
    try {
      if (confirm === "activate") {
        await activateStore(s.id);
        toast.success(t.activate.done);
        await refresh();
      } else if (confirm === "password") {
        const result = await resetOwnerPassword(s.id);
        setPassword(result.temporary_password);
        await refresh();
      }
      setConfirm(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: t.back, href: "/admin/stores" }, { label: s.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {s.name}
            {suspended ? (
              <Badge tone="danger">
                <Ban />
                {ar.admin.stores.status.suspended}
              </Badge>
            ) : null}
          </span>
        }
        description={[s.created_at ? t.since(day(s.created_at)) : null, s.owner?.last_login_at ? t.lastLogin(formatDateTime(s.owner.last_login_at)) : null].filter(Boolean).join(" · ")}
        actions={
          <>
            {s.store_url ? (
              <Button asChild variant="outline">
                <a href={s.store_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  {t.open}
                </a>
              </Button>
            ) : null}
            <Menu>
              <MenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t.actions}>
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => setConfirm("password")}>
                  <KeyRound />
                  {t.password.action}
                </MenuItem>
                <MenuSeparator />
                {suspended ? (
                  <MenuItem onSelect={() => setConfirm("activate")}>
                    <Power />
                    {t.activate.action}
                  </MenuItem>
                ) : (
                  <MenuItem destructive onSelect={suspend.show}>
                    <Ban />
                    {t.suspend.action}
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        {suspended ? (
          <Alert
            tone="danger"
            title={t.suspended}
            action={
              <Button size="sm" variant="outline" onClick={() => setConfirm("activate")}>
                <Power />
                {t.activate.action}
              </Button>
            }
          >
            {t.suspendedText(formatDateTime(s.suspended_at), s.suspended_reason ?? "")}
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label={t.stats.orders} value={formatNumber(s.orders_count)} hint={s.last_order_at ? t.stats.lastOrder(day(s.last_order_at)) : t.stats.noOrders} />
          <StatCard label={t.stats.sales} value={formatMoney(s.sales)} />
          <StatCard label={t.stats.products} value={formatNumber(s.products_count)} />
          <StatCard label={t.stats.customers} value={formatNumber(s.customers_count)} />
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <BillingPanel store={s} onChanged={refresh} />
            <HistoryPanel storeId={s.id} />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <OwnerPanel store={s} />
            <DomainsPanel store={s} />
            <ThemesPanel storeId={s.id} />
          </div>
        </div>
      </div>

      <SuspendDialog storeId={s.id} open={suspend.open} onOpenChange={suspend.onOpenChange} onDone={refresh} />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => (open ? undefined : setConfirm(null))}
        title={confirm === "password" ? t.password.title : t.activate.title}
        description={confirm === "password" ? t.password.text : t.activate.text}
        confirmLabel={confirm === "password" ? t.password.confirm : t.activate.confirm}
        loading={busy}
        onConfirm={() => void confirmAction()}
      />
      <PasswordResultDialog password={password} onClose={() => setPassword(null)} />
    </>
  );
}

function OwnerPanel({ store }: { store: StoreDetail }) {
  const o = store.owner;
  const w = o?.phone ? whatsappLink(o.phone, "") : null;
  return (
    <Panel>
      <PanelHeader
        title={t.owner.title}
        actions={
          w ? (
            <Button asChild variant="ghost" size="sm">
              <a href={w} target="_blank" rel="noopener noreferrer">
                <MessageCircle />
                {t.owner.whatsapp}
              </a>
            </Button>
          ) : null
        }
      />
      <PanelBody>
        {o ? (
          <DescriptionList
            columns={1}
            items={[
              { label: t.owner.name, value: o.name },
              {
                label: t.owner.phone,
                value: (
                  <a href={`tel:${o.phone ?? ""}`} dir="ltr" className="tabular hover:underline">
                    {formatPhone(o.phone)}
                  </a>
                ),
              },
              { label: t.owner.email, value: o.email ? <span dir="ltr">{o.email}</span> : "—" },
              { label: t.owner.lastLogin, value: o.last_login_at ? formatDateTime(o.last_login_at) : ar.admin.stores.never },
            ]}
          />
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function DomainsPanel({ store }: { store: StoreDetail }) {
  const d = t.domains;
  return (
    <Panel>
      <PanelHeader title={d.title} />
      <PanelBody>
        <ul className="flex flex-col gap-2">
          {store.domains.map((domain) => (
            <li key={domain.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span dir="ltr" className="tabular min-w-0 flex-1 truncate font-semibold">
                {domain.host}
              </span>
              {domain.is_primary ? (
                <Badge tone="brand-soft" size="sm">
                  {d.primary}
                </Badge>
              ) : null}
              <Badge tone={domain.status === "active" ? "success" : domain.status === "failed" ? "danger" : "warning"} size="sm" dot>
                {domain.type === "subdomain" ? d.subdomain : d.custom} · {d.status[domain.status] ?? domain.status}
              </Badge>
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}

function BillingPanel({ store, onChanged }: { store: StoreDetail; onChanged: () => Promise<unknown> }) {
  const b = t.billing;
  const query = useStoreBilling(store.id);
  const grant = useDialog();
  const extend = useDialog();
  const override = useDialog();
  const [removing, setRemoving] = React.useState<string | null>(null);

  async function removeOverride(key: string) {
    setRemoving(key);
    try {
      await deleteOverride(store.id, key);
      toast.success(t.overrides.removed);
      await Promise.all([query.refetch(), onChanged()]);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRemoving(null);
    }
  }

  const data = query.data;
  const done = async () => {
    await Promise.all([query.refetch(), onChanged()]);
  };

  return (
    <>
      <Panel>
        <PanelHeader
          title={b.title}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={extend.show} disabled={!data?.plan}>
                <CalendarPlus />
                {b.extend}
              </Button>
              <Button size="sm" onClick={grant.show}>
                <Gift />
                {b.grant}
              </Button>
            </div>
          }
        />
        <PanelBody className="flex flex-col gap-5">
          {query.isPending ? (
            <Skeleton className="h-40" />
          ) : query.isError || !data ? (
            <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
          ) : (
            <>
              <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
                <PlanCell store={store} />
                <DescriptionList
                  columns={3}
                  className="flex-1"
                  items={[
                    { label: b.state, value: data.plan ? (b.states[data.state] ?? data.state) : b.none },
                    { label: b.period, value: data.period ? (b.periods[data.period] ?? data.period) : "—" },
                    { label: b.graceEndsAt, value: data.grace_ends_at ? formatDateTime(data.grace_ends_at) : "—" },
                  ]}
                />
              </div>

              <div>
                <p className="mb-2 text-[13px] font-semibold">{b.usage}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.usage.map((u) => (
                    <Meter key={u.key} used={u.used} limit={u.unlimited ? null : u.limit} label={entitlementLabel(u.key, u.label)} />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span>
                    <p className="text-[13px] font-semibold">{t.overrides.title}</p>
                    <p className="text-xs text-ink-3">{t.overrides.hint}</p>
                  </span>
                  <Button size="sm" variant="ghost" onClick={override.show}>
                    <Plus />
                    {t.overrides.add}
                  </Button>
                </div>
                {data.overrides.length === 0 ? (
                  <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] text-ink-3">{t.overrides.empty}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                    {data.overrides.map((o) => (
                      <li key={o.entitlement} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-semibold">
                            {entitlementLabel(o.entitlement)}:{" "}
                            <span className="tabular">{o.entitlement in ar.settings.billing.features ? (o.value ? t.overrides.on : t.overrides.off) : t.overrides.value(o.value)}</span>
                          </span>
                          <span className="text-xs text-ink-3">
                            {o.reason}
                            {o.expires_at ? ` · ${t.overrides.until(formatDateTime(o.expires_at))}` : ""}
                          </span>
                        </span>
                        <Button size="icon" variant="ghost" aria-label={t.overrides.remove} loading={removing === o.entitlement} onClick={() => void removeOverride(o.entitlement)}>
                          <Trash2 />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-2 text-[13px] font-semibold">{b.history}</p>
                {data.subscriptions.length === 0 ? (
                  <p className="text-[13px] text-ink-3">{b.noHistory}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                    {data.subscriptions.map((sub) => (
                      <li key={sub.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                        <span className="font-semibold">{sub.plan_name}</span>
                        <Badge size="sm" tone={sub.source === "payment" ? "success" : sub.source === "trial" ? "info" : "brand-soft"}>
                          {b.sources[sub.source] ?? sub.source}
                        </Badge>
                        <Badge size="sm" tone={sub.status === "active" ? "success" : "neutral"}>
                          {b.subStatus[sub.status] ?? sub.status}
                        </Badge>
                        <span className="tabular text-xs text-ink-3">{b.range(day(sub.starts_at), day(sub.ends_at))}</span>
                        {sub.amount_paid > 0 ? <span className="tabular ms-auto text-xs font-semibold">{b.paid(sub.amount_paid)}</span> : null}
                        {sub.note ? <span className="w-full text-xs text-ink-3">{sub.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </PanelBody>
      </Panel>
      <GrantPlanDialog storeId={store.id} open={grant.open} onOpenChange={grant.onOpenChange} onDone={done} currentPlan={data?.plan?.key ?? null} />
      <ExtendDialog storeId={store.id} open={extend.open} onOpenChange={extend.onOpenChange} onDone={done} />
      <OverrideDialog storeId={store.id} open={override.open} onOpenChange={override.onOpenChange} onDone={done} />
    </>
  );
}

function ThemesPanel({ storeId }: { storeId: number }) {
  const th = t.themes;
  const query = useStoreThemes(storeId);
  const grant = useDialog();
  const [revoking, setRevoking] = React.useState<string | null>(null);

  async function revoke(key: string) {
    setRevoking(key);
    try {
      await revokeTheme(storeId, key);
      toast.success(th.revoked);
      await query.refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title={th.title}
        actions={
          <Button size="sm" variant="ghost" onClick={grant.show}>
            <Gift />
            {th.grant}
          </Button>
        }
      />
      <PanelBody>
        {query.isPending ? (
          <Skeleton className="h-16" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
        ) : query.data.length === 0 ? (
          <p className="text-[13px] text-ink-3">{th.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {query.data.map((p) => (
              <li key={p.theme_key} className="flex items-center gap-2 text-sm">
                <span className="flex-1 font-semibold">{p.name}</span>
                <Badge size="sm" tone={p.source === "admin_grant" ? "brand-soft" : "success"}>
                  {th.sources[p.source] ?? p.source}
                </Badge>
                {p.source === "admin_grant" ? (
                  <Button size="icon" variant="ghost" aria-label={th.revoke} loading={revoking === p.theme_key} onClick={() => void revoke(p.theme_key)}>
                    <Trash2 />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
      <GrantThemeDialog storeId={storeId} open={grant.open} onOpenChange={grant.onOpenChange} onDone={() => query.refetch()} owned={query.data ?? []} />
    </Panel>
  );
}

function HistoryPanel({ storeId }: { storeId: number }) {
  const h = t.history;
  const query = useActivity({ tenant: storeId });
  return (
    <Panel>
      <PanelHeader title={h.title} />
      <PanelBody>
        {query.isPending ? (
          <Skeleton className="h-24" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
        ) : query.data.data.length === 0 ? (
          <EmptyState compact title={h.empty} />
        ) : (
          <Timeline
            events={query.data.data.map((row) => ({
              id: row.id,
              title: ar.admin.actions[row.action] ?? row.action,
              by: row.admin ? h.by(row.admin.name) : undefined,
              at: row.created_at ?? "",
              body: describe(row.meta),
              tone: row.action === "tenant.suspend" || row.action === "payment.reject" ? "danger" : row.action.endsWith("grant") || row.action === "payment.approve" ? "success" : "neutral",
            }))}
          />
        )}
      </PanelBody>
    </Panel>
  );
}

/** The useful part of a log row (the reason, the plan and days, the limit). */
function describe(meta: Record<string, unknown> | null): string | undefined {
  if (!meta) return undefined;
  const parts: string[] = [];
  if (typeof meta.reason === "string") parts.push(meta.reason);
  if (typeof meta.plan_key === "string") parts.push(meta.plan_key);
  if (typeof meta.days === "number") parts.push(t.history.days(meta.days));
  if (typeof meta.entitlement === "string") parts.push(entitlementLabel(meta.entitlement));
  if (typeof meta.theme_key === "string") parts.push(meta.theme_key);
  if (typeof meta.invoice === "string") parts.push(meta.invoice);
  return parts.length ? parts.join(" · ") : undefined;
}
