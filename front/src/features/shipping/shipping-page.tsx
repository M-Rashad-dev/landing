"use client";

import { ArrowLeft, MoreHorizontal, Pencil, Plus, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { SortableList } from "@/components/data/sortable-list";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch, SwitchRow } from "@/components/ui/choice";
import { Alert, EmptyState, ErrorState, Skeleton, toast } from "@/components/ui/feedback";
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { Panel, PanelBody, PanelHeader, Thumb } from "@/components/ui/panel";
import { useCount } from "@/features/promotions/api";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { deleteCompany, reorderCompanies, setShippingEnabled, toggleCompany, useRefreshShipping, useShipping, type Company } from "./api";
import { CompanyDrawer, type CompanyDrawerState } from "./company-drawer";

const t = ar.shipping;

export function ShippingPage() {
  const query = useShipping();
  const refresh = useRefreshShipping();
  const offers = useCount("shippingOffers");
  const [drawer, setDrawer] = React.useState<CompanyDrawerState>(null);
  const [deleting, setDeleting] = React.useState<Company | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [switchError, setSwitchError] = React.useState<string | null>(null);
  const [order, setOrder] = React.useState<Company[] | null>(null);

  const data = query.data;
  const companies = order ?? data?.companies ?? [];
  const total = data?.governorates.length ?? 0;

  async function onSwitch(enabled: boolean) {
    setSwitchError(null);
    try {
      await setShippingEnabled(enabled);
      toast.success(enabled ? t.turnedOn : t.turnedOff);
      await refresh();
    } catch (error) {
      if (isApiError(error) && error.isValidation) setSwitchError(error.errors.enabled?.[0] ?? errorMessage(error));
      else toast.error(errorMessage(error));
    }
  }

  async function onToggle(c: Company) {
    try {
      const updated = await toggleCompany(c.id);
      toast.success(t.toggled(updated.is_active));
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function onReorder(next: Company[]) {
    setOrder(next);
    try {
      await reorderCompanies(next.map((c) => c.id));
      toast.success(t.reordered);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setOrder(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteCompany(deleting.id);
      toast.success(t.deleted);
      setDeleting(null);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => setDrawer({ mode: "create" })} disabled={!data}>
            <Plus />
            {t.add}
          </Button>
        }
      />

      {query.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : query.isError || !data ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelBody className="py-3">
              <SwitchRow title={t.enabled} description={t.enabledHint} checked={data.enabled} onCheckedChange={(v) => void onSwitch(v)} />
              {switchError ? <Alert tone="warning">{switchError}</Alert> : null}
            </PanelBody>
          </Panel>

          <section>
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <h2 className="font-semibold">{t.companies}</h2>
                {companies.length > 1 ? <p className="text-xs text-ink-3">{t.companiesHint}</p> : null}
              </div>
            </div>
            {companies.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface">
                <EmptyState
                  icon={Truck}
                  title={t.emptyTitle}
                  description={t.emptyText}
                  action={
                    <Button onClick={() => setDrawer({ mode: "create" })}>
                      <Plus />
                      {t.add}
                    </Button>
                  }
                />
              </div>
            ) : (
              <SortableList
                items={companies}
                getId={(c) => String(c.id)}
                onReorder={(next) => void onReorder(next)}
                render={(c) => (
                  <div className="flex items-center gap-3">
                    {c.logo ? (
                      <Thumb src={c.logo.thumb} alt={c.name} size={40} />
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-strong">
                        <Truck className="size-5" aria-hidden />
                      </span>
                    )}
                    <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setDrawer({ mode: "edit", company: c })}>
                      <span className="flex flex-wrap items-center gap-2 font-semibold">
                        {c.name}
                        {!c.is_active ? <Badge tone="warning">{t.inactive}</Badge> : null}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-3">
                        <span>{t.fee(c.default_fee)}</span>
                        <span>{t.served(c.served_count, total)}</span>
                        {t.days(c.delivery_days_min, c.delivery_days_max) ? <span>{t.days(c.delivery_days_min, c.delivery_days_max)}</span> : null}
                      </span>
                    </button>
                    <span className="hidden text-sm font-semibold tabular sm:block">{formatMoney(c.default_fee)}</span>
                    <Switch checked={c.is_active} onCheckedChange={() => void onToggle(c)} aria-label={ar.promotions.active} />
                    <Menu>
                      <MenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label={ar.common.actions}>
                          <MoreHorizontal />
                        </Button>
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem onSelect={() => setDrawer({ mode: "edit", company: c })}>
                          <Pencil />
                          {ar.common.edit}
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem destructive onSelect={() => setDeleting(c)}>
                          <Trash2 />
                          {ar.common.delete}
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                )}
              />
            )}
          </section>

          <Panel>
            <PanelHeader
              title={t.offersTitle}
              description={t.offersText}
              actions={
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/marketing/offers?tab=shipping">
                    {t.offersLink}
                    <ArrowLeft />
                  </Link>
                </Button>
              }
            />
            <PanelBody className="py-3 text-sm text-ink-2">{offers.data === undefined ? <Skeleton className="h-4 w-24" /> : t.offersCount(offers.data)}</PanelBody>
          </Panel>
        </div>
      )}

      <CompanyDrawer state={drawer} governorates={data?.governorates ?? []} onClose={() => setDrawer(null)} />
      <ConfirmDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)} title={deleting ? t.deleteTitle(deleting.name) : ""} description={t.deleteText} confirmLabel={ar.common.delete} destructive loading={busy} onConfirm={() => void confirmDelete()} />
    </>
  );
}
