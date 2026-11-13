"use client";

import { CalendarClock, ReceiptText, Undo2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { ar } from "@/messages/ar";
import { useAdminOverview } from "./api";

const t = ar.admin.attention;

/** The dashboard frame for the platform owner: its own sidebar, and the bell lists what waits. */
export function AdminShell({ name, children }: { name: string; children: React.ReactNode }) {
  const overview = useAdminOverview();
  const pending = overview.data?.billing.pending_payments ?? 0;
  const refunds = overview.data?.billing.refund_requests ?? 0;
  const expiring = overview.data?.subscriptions.expiring_week ?? 0;

  return (
    <AppShell
      area="admin"
      account={{ name, store: ar.admin.role, storeUrl: null }}
      badges={{ "/admin/payments": pending, "/admin/refunds": refunds }}
      alertCount={pending + refunds}
      notifications={<AttentionList pending={pending} refunds={refunds} expiring={expiring} />}
    >
      {children}
    </AppShell>
  );
}

export function AttentionList({ pending, refunds, expiring }: { pending: number; refunds: number; expiring: number }) {
  const items: Array<{ key: string; icon: LucideIcon; label: string; href: string; tone: string }> = [
    pending > 0 ? { key: "payments", icon: ReceiptText, label: t.payments(pending), href: "/admin/payments", tone: "bg-accent-soft text-accent-ink" } : null,
    refunds > 0 ? { key: "refunds", icon: Undo2, label: t.refunds(refunds), href: "/admin/refunds", tone: "bg-danger-soft text-danger" } : null,
    expiring > 0 ? { key: "expiring", icon: CalendarClock, label: t.expiring(expiring), href: "/admin/stores?tab=expiring", tone: "bg-info-soft text-info" } : null,
  ].filter((i) => i !== null);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{t.title}</p>
      {items.length === 0 ? (
        <p className="text-[13px] text-ink-3">{t.none}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map(({ key, icon: Icon, label, href, tone }) => {
            return (
              <li key={key}>
                <Link href={href} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-surface-2">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`} aria-hidden>
                    <Icon className="size-4" />
                  </span>
                  <span className="text-[13px] font-semibold">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
