import {
  BadgePercent,
  Ban,
  Building2,
  FileText,
  Fingerprint,
  Globe,
  Home,
  Images,
  LayoutDashboard,
  Package,
  Palette,
  Settings,
  ShoppingBag,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { ar } from "@/messages/ar";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Sub-paths that belong to another item (e.g. /dashboard/orders/blocked). */
  exclude?: string[];
  badgeKey?: "orders";
};

/** Sidebar groups. Every feature has one place; see ROADMAP.md for where upcoming ones go. */
export type NavGroup = { label?: string; items: NavItem[] };

export const DASHBOARD_NAV: NavGroup[] = [
  { items: [{ href: "/dashboard", label: ar.nav.home, icon: Home, exact: true }] },
  {
    label: ar.nav.groups.sales,
    items: [
      { href: "/dashboard/orders", label: ar.nav.orders, icon: ShoppingBag, badgeKey: "orders", exclude: ["/dashboard/orders/blocked"] },
      { href: "/dashboard/orders/blocked", label: ar.nav.blocked, icon: Ban },
    ],
  },
  {
    label: ar.nav.groups.pages,
    items: [{ href: "/dashboard/pages", label: ar.nav.pages, icon: FileText }],
  },
  {
    label: ar.nav.groups.catalog,
    items: [
      { href: "/dashboard/products", label: ar.nav.products, icon: Package },
      { href: "/dashboard/offers", label: ar.nav.offers, icon: BadgePercent },
      { href: "/dashboard/discount-codes", label: ar.nav.discountCodes, icon: Tag },
    ],
  },
  {
    label: ar.nav.groups.store,
    items: [
      { href: "/dashboard/identities", label: ar.nav.identities, icon: Fingerprint },
      { href: "/dashboard/media", label: ar.nav.media, icon: Images },
      { href: "/dashboard/domains", label: ar.nav.domains, icon: Globe },
    ],
  },
];

/** Pinned at the bottom of the sidebar. */
export const DASHBOARD_FOOTER_NAV: NavItem[] = [{ href: "/dashboard/settings", label: ar.nav.settings, icon: Settings }];

export const ADMIN_NAV: NavGroup[] = [
  {
    items: [
      { href: "/admin", label: ar.admin.nav.overview, icon: LayoutDashboard, exact: true },
      { href: "/admin/tenants", label: ar.admin.nav.tenants, icon: Building2 },
      { href: "/admin/themes", label: ar.admin.nav.themes, icon: Palette },
    ],
  },
];

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact" | "exclude">): boolean {
  if (item.exclude?.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return false;
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
