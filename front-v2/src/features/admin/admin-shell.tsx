"use client";

import { CalendarClock, ReceiptText, Undo2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { ADMIN_FOOTER_NAV, ADMIN_NAV } from "@/config/navigation";
import { ar } from "@/messages/ar";
import { useAdminOverview } from "./api";

const t = ar.admin.attention;

const READY = new Set([...ADMIN_NAV.flatMap((g) => g.items), ...ADMIN_FOOTER_NAV].filter((i) => i.status === "ready").map((i) => i.href));

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
            const ready = READY.has(href.split("?")[0]);
            const body = (
              <>
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`} aria-hidden>
                  <Icon className="size-4" />
                </span>
                <span className="flex flex-col">
                  <span className="text-[13px] font-semibold">{label}</span>
                  {ready ? null : <span className="text-[11px] text-ink-3">{t.soonHint}</span>}
                </span>
              </>
            );
            return (
              <li key={key}>
                {ready ? (
                  <Link href={href} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-surface-2">
                    {body}
                  </Link>
                ) : (
                  <span className="flex items-center gap-3 p-1.5">{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
