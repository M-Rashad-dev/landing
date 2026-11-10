import {
  BadgePercent,
  BarChart3,
  Ban,
  Building2,
  Crown,
  FileText,
  Fingerprint,
  FlaskConical,
  Gift,
  Globe,
  Home,
  Images,
  LayoutTemplate,
  LayoutDashboard,
  Package,
  Palette,
  PhoneCall,
  Settings,
  Sheet,
  ShoppingBag,
  Tag,
  Truck,
  UserRoundSearch,
  type LucideIcon,
} from "lucide-react";
import type { PlanFeatureKey, PlanLimitKey } from "@/lib/billing/types";
import { ar } from "@/messages/ar";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Sub-paths that belong to another item (e.g. /dashboard/orders/blocked). */
  exclude?: string[];
  badgeKey?: "orders";
  /** Plan feature / limit behind this screen: a lock shows when the plan closes it. */
  gate?: { feature?: PlanFeatureKey; limit?: PlanLimitKey };
};

/** Sidebar groups. Every feature has one place; see ROADMAP.md for where upcoming ones go. */
export type NavGroup = { label?: string; items: NavItem[] };

export const DASHBOARD_NAV: NavGroup[] = [
  { items: [{ href: "/dashboard", label: ar.nav.home, icon: Home, exact: true }] },
  {
    label: ar.nav.groups.sales,
    items: [
      { href: "/dashboard/orders/confirm", label: ar.nav.confirm, icon: PhoneCall, badgeKey: "orders" },
      { href: "/dashboard/orders", label: ar.nav.orders, icon: ShoppingBag, exclude: ["/dashboard/orders/blocked", "/dashboard/orders/confirm"] },
      { href: "/dashboard/leads", label: ar.nav.leads, icon: UserRoundSearch, gate: { feature: "abandoned_leads" } },
      { href: "/dashboard/orders/blocked", label: ar.nav.blocked, icon: Ban },
    ],
  },
  {
    label: ar.nav.groups.pages,
    items: [
      { href: "/dashboard/pages", label: ar.nav.pages, icon: FileText, exclude: ["/dashboard/pages/templates"] },
      { href: "/dashboard/pages/templates", label: ar.nav.templates, icon: LayoutTemplate },
      { href: "/dashboard/ab-tests", label: ar.nav.abTests, icon: FlaskConical, gate: { limit: "ab_tests" } },
      { href: "/dashboard/analytics", label: ar.nav.analytics, icon: BarChart3, gate: { feature: "advanced_analytics" } },
    ],
  },
  {
    label: ar.nav.groups.catalog,
    items: [
      { href: "/dashboard/products", label: ar.nav.products, icon: Package },
      { href: "/dashboard/offers", label: ar.nav.offers, icon: BadgePercent },
      { href: "/dashboard/discount-codes", label: ar.nav.discountCodes, icon: Tag },
      { href: "/dashboard/upsells", label: ar.nav.upsells, icon: Gift, gate: { feature: "upsells" } },
    ],
  },
  {
    label: ar.nav.groups.store,
    items: [
      { href: "/dashboard/identities", label: ar.nav.identities, icon: Fingerprint },
      { href: "/dashboard/media", label: ar.nav.media, icon: Images },
      { href: "/dashboard/shipping", label: ar.nav.shipping, icon: Truck },
      { href: "/dashboard/domains", label: ar.nav.domains, icon: Globe },
    ],
  },
  {
    label: ar.nav.groups.connect,
    items: [{ href: "/dashboard/integrations", label: ar.nav.integrations, icon: Sheet, gate: { limit: "webhooks" } }],
  },
];

/** Pinned at the bottom of the sidebar. */
export const DASHBOARD_FOOTER_NAV: NavItem[] = [
  { href: "/dashboard/settings/plan", label: ar.nav.plan, icon: Crown },
  { href: "/dashboard/settings", label: ar.nav.settings, icon: Settings, exclude: ["/dashboard/settings/plan"] },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    items: [
      { href: "/admin", label: ar.admin.nav.overview, icon: LayoutDashboard, exact: true },
      { href: "/admin/tenants", label: ar.admin.nav.tenants, icon: Building2 },
      { href: "/admin/themes", label: ar.admin.nav.themes, icon: Palette },
      { href: "/admin/plans", label: ar.admin.nav.plans, icon: Crown },
    ],
  },
];

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact" | "exclude">): boolean {
  if (item.exclude?.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return false;
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
