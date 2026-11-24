"use client";

import { Undo2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Pagination } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Panel, PanelBody } from "@/components/ui/panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/session-context";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";
import { useRefreshOrders, useRefunds, type RefundTab } from "./api";
import { RefundRow } from "./refunds-card";

const t = ar.refunds.page;
const TABS: RefundTab[] = ["pending", "done", "cancelled", "all"];

/** «الطلبات ← المبالغ المسترجعة»: what must still go back to customers (first), and what went back. */
export function RefundsPage() {
  const can = useCan();
  const [tab, setTab] = React.useState<RefundTab>("pending");
  const [page, setPage] = React.useState(1);
  const query = useRefunds(tab, page);
  const refresh = useRefreshOrders();
  const meta = query.data?.meta;

  return (
    <>
      <PageHeader
        crumbs={[{ label: ar.orders.detail.back, href: "/dashboard/orders" }, { label: t.title }]}
        title={t.title}
        description={t.description}
        tabs={
          <Tabs value={tab} onValueChange={(v) => (setTab(v as RefundTab), setPage(1))}>
            <TabsList>
              {TABS.map((key) => (
                <TabsTrigger key={key} value={key} count={key === "pending" ? meta?.pending_count : undefined}>
                  {t.tabs[key]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />
      {query.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />
      ) : (
        <div className="flex flex-col gap-3">
          {tab === "pending" && meta && meta.pending_count > 0 ? <Alert tone="warning">{t.pendingSummary(meta.pending_count, formatMoney(meta.pending_total))}</Alert> : null}
          {query.data.data.length === 0 ? (
            <EmptyState icon={Undo2} title={tab === "pending" ? t.emptyPending : t.empty} />
          ) : (
            <Panel>
              <PanelBody>
                <ul className="flex flex-col gap-2">
                  {query.data.data.map((refund) => (
                    <li key={refund.id} className="flex flex-col gap-1">
                      <Link href={`/dashboard/orders/${refund.order_id}`} className="w-fit text-xs font-medium text-primary hover:underline">
                        {t.order} #{refund.order_number} · {refund.customer_name}
                      </Link>
                      <RefundRow refund={refund} manage={can("orders.refunds")} onSaved={refresh} />
                    </li>
                  ))}
                </ul>
              </PanelBody>
            </Panel>
          )}
          {query.data.meta.last_page > 1 ? <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPageChange={setPage} /> : null}
        </div>
      )}
    </>
  );
}
