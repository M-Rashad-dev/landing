"use client";

import { Gift, Layers, Percent, Plus, Tag, Truck, type LucideIcon } from "lucide-react";
import * as React from "react";
import { Meter } from "@/components/data/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { usePlanLimit } from "@/lib/auth/session-context";
import { useUrlState } from "@/lib/use-url-state";
import { ar } from "@/messages/ar";
import { deletePromo, STATUS_FILTERS, togglePromo, useCount, useOffers, useRefresh, useShippingOffers, type Offer, type OfferType, type ShippingOffer, type StatusFilter } from "../api";
import { ListToolbar, periodText, PromoList, PromoRow, targetText, useDebouncedSearch } from "../shared";
import { shippingOfferSummary, ShippingOfferDrawer, type ShippingOfferDrawerState } from "../shipping-offers/shipping-offer-drawer";
import { OfferDrawer, offerSummary, type OfferDrawerState } from "./offer-drawer";

const t = ar.promotions.offers;
const s = ar.promotions.shippingOffers;

const ICONS: Record<OfferType, LucideIcon> = { percentage: Percent, fixed: Tag, bundle: Layers, buy_get: Plus, gift: Gift };

type Tab = "products" | "shipping";

export function OffersPage() {
  const [url, setUrl] = useUrlState(["tab", "q", "status", "page"] as const);
  const tab: Tab = url.tab === "shipping" ? "shipping" : "products";
  const commitSearch = React.useCallback((q: string | null) => setUrl({ q, page: null }), [setUrl]);
  const [search, setSearch] = useDebouncedSearch(url.q, commitSearch);
  const filters = {
    q: url.q,
    status: ((STATUS_FILTERS as readonly string[]).includes(url.status) ? url.status : "all") as StatusFilter,
    page: Math.max(1, Number(url.page) || 1),
  };
  const productCount = useCount("offers");
  const shippingCount = useCount("shippingOffers");
  const limit = usePlanLimit("offers");
  const [offerDrawer, setOfferDrawer] = React.useState<OfferDrawerState>(null);
  const [shippingDrawer, setShippingDrawer] = React.useState<ShippingOfferDrawerState>(null);

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => (tab === "shipping" ? setShippingDrawer({ mode: "create" }) : setOfferDrawer({ mode: "create" }))}>
            <Plus />
            {tab === "shipping" ? t.addShipping : t.add}
          </Button>
        }
        tabs={
          <Tabs value={tab} onValueChange={(v) => setUrl({ tab: v === "products" ? null : v, q: null, status: null, page: null })}>
            <TabsList>
              <TabsTrigger value="products" count={productCount.data}>
                {t.tabs.products}
              </TabsTrigger>
              <TabsTrigger value="shipping" count={shippingCount.data}>
                {t.tabs.shipping}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {tab === "products" && limit !== null && productCount.data !== undefined ? (
        <div className="mb-4 max-w-xs">
          <Meter used={productCount.data} limit={limit} label={t.tabs.products} />
        </div>
      ) : null}

      <ListToolbar search={search} onSearch={setSearch} status={filters.status} onStatus={(v) => setUrl({ status: v === "all" ? null : v, page: null })} placeholder={ar.promotions.search} />

      {tab === "products" ? (
        <ProductOffers
          filters={filters}
          onEdit={(offer) => setOfferDrawer({ mode: "edit", offer })}
          onCreate={() => setOfferDrawer({ mode: "create" })}
          onClear={() => {
            setSearch("");
            setUrl({ q: null, status: null, page: null });
          }}
          onPage={(page) => setUrl({ page: String(page) })}
        />
      ) : (
        <ShippingOffers
          filters={filters}
          onEdit={(offer) => setShippingDrawer({ mode: "edit", offer })}
          onCreate={() => setShippingDrawer({ mode: "create" })}
          onClear={() => {
            setSearch("");
            setUrl({ q: null, status: null, page: null });
          }}
          onPage={(page) => setUrl({ page: String(page) })}
        />
      )}

      <OfferDrawer state={offerDrawer} onClose={() => setOfferDrawer(null)} />
      <ShippingOfferDrawer state={shippingDrawer} onClose={() => setShippingDrawer(null)} />
    </>
  );
}

type ListProps<T> = { filters: { q: string; status: StatusFilter; page: number }; onEdit: (item: T) => void; onCreate: () => void; onClear: () => void; onPage: (page: number) => void };

function useRowActions(resource: "offers" | "shippingOffers") {
  const refresh = useRefresh(resource);
  const [deleting, setDeleting] = React.useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function toggle(id: number) {
    try {
      const updated = await togglePromo(resource, id);
      toast.success(ar.promotions.toggled(updated.is_active));
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const dialog = (
    <ConfirmDialog
      open={deleting !== null}
      onOpenChange={(o) => !o && setDeleting(null)}
      title={deleting ? (resource === "offers" ? t.deleteTitle(deleting.name) : s.deleteTitle(deleting.name)) : ""}
      description={t.deleteText}
      confirmLabel={ar.common.delete}
      destructive
      loading={busy}
      onConfirm={async () => {
        if (!deleting) return;
        setBusy(true);
        try {
          await deletePromo(resource, deleting.id);
          toast.success(resource === "offers" ? t.deleted : s.deleted);
          setDeleting(null);
          await refresh();
        } catch (error) {
          toast.error(errorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    />
  );

  return { toggle, askDelete: setDeleting, dialog };
}

function ProductOffers({ filters, onEdit, onCreate, onClear, onPage }: ListProps<Offer>) {
  const query = useOffers(filters);
  const actions = useRowActions("offers");
  return (
    <>
      <PromoList
        query={query}
        filtered={Boolean(filters.q || filters.status !== "all")}
        empty={{ icon: Tag, title: t.emptyTitle, text: t.emptyText, action: <Button onClick={onCreate}><Plus />{t.add}</Button> }}
        onClearFilters={onClear}
        onPage={onPage}
      >
        {(items) =>
          items.map((o) => (
            <PromoRow
              key={o.id}
              icon={ICONS[o.type]}
              title={o.name}
              summary={offerSummary(
                { type: o.type, value: String(o.value ?? ""), min_quantity: String(o.min_quantity), bundle_quantity: String(o.bundle_quantity ?? ""), bundle_price: String(o.bundle_price ?? ""), free_quantity: String(o.free_quantity ?? "") },
                o.gift_product?.name ?? "",
              )}
              meta={[targetText(o), o.badge_text ? `«${o.badge_text}»` : null, periodText(o)]}
              status={o.status}
              locked={o.locked_by_plan}
              active={o.is_active}
              onToggle={() => void actions.toggle(o.id)}
              onEdit={() => onEdit(o)}
              onDelete={() => actions.askDelete({ id: o.id, name: o.name })}
            />
          ))
        }
      </PromoList>
      {actions.dialog}
    </>
  );
}

function ShippingOffers({ filters, onEdit, onCreate, onClear, onPage }: ListProps<ShippingOffer>) {
  const query = useShippingOffers(filters);
  const actions = useRowActions("shippingOffers");
  return (
    <>
      <PromoList
        query={query}
        filtered={Boolean(filters.q || filters.status !== "all")}
        empty={{ icon: Truck, title: s.emptyTitle, text: s.emptyText, action: <Button onClick={onCreate}><Plus />{t.addShipping}</Button> }}
        onClearFilters={onClear}
        onPage={onPage}
      >
        {(items) =>
          items.map((o) => (
            <PromoRow
              key={o.id}
              icon={Truck}
              title={o.name}
              summary={shippingOfferSummary({ benefit: o.benefit, value: String(o.value ?? ""), min_quantity: String(o.min_quantity ?? ""), min_total: String(o.min_total ?? "") })}
              meta={[
                targetText(o),
                o.governorates.length ? s.inGovernorates(o.governorates.length) : null,
                o.company_ids.length ? s.viaCompanies(o.company_ids.length) : null,
                periodText(o),
              ]}
              status={o.status}
              active={o.is_active}
              onToggle={() => void actions.toggle(o.id)}
              onEdit={() => onEdit(o)}
              onDelete={() => actions.askDelete({ id: o.id, name: o.name })}
            />
          ))
        }
      </PromoList>
      {actions.dialog}
    </>
  );
}
