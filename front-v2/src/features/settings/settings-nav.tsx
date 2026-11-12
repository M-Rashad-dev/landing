"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const TABS = [
  { href: "/dashboard/settings/account", key: "account" },
  { href: "/dashboard/settings/domains", key: "domains" },
  { href: "/dashboard/settings/billing", key: "billing" },
] as const;

/** «الإعدادات» sub-pages as tabs (links, so each one has its own address). */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label={ar.settings.title} className="no-scrollbar mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors", active ? "border-brand text-ink" : "border-transparent text-ink-3 hover:text-ink")}
          >
            {ar.settings.tabs[tab.key]}
          </Link>
        );
      })}
    </nav>
  );
}
