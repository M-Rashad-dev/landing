"use client";

import { ShieldX } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { EmptyState } from "@/components/ui/feedback";
import { navigationOf } from "@/config/navigation";
import { canOpen } from "@/lib/auth/permissions";
import { ar } from "@/messages/ar";

/**
 * Staff opening a page they weren't given see «مش مسموح لك» (the server refuses its data anyway); the home page sends
 * them to the first page they can open.
 */
export function PermissionGate({ permissions, children }: { permissions?: readonly string[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = canOpen(permissions, pathname);
  const first = React.useMemo(() => {
    const nav = navigationOf("dashboard", permissions);
    return [...nav.groups.flatMap((g) => g.items), ...nav.footer].find((i) => i.href !== "/dashboard")?.href ?? null;
  }, [permissions]);

  React.useEffect(() => {
    if (!allowed && pathname === "/dashboard" && first) router.replace(first);
  }, [allowed, pathname, first, router]);

  if (allowed) return <>{children}</>;
  return <EmptyState icon={ShieldX} title={ar.staff.denied.title} description={ar.staff.denied.text} className="mt-10" />;
}
