import {
  BadgePercent,
  Building2,
  LayoutDashboard,
  Palette,
  FileText,
  Fingerprint,
  Globe,
  Home,
  Images,
  Package,
  Settings,
  ShoppingBag,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { ar } from "@/messages/ar";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; badgeKey?: "orders" };

export const DASHBOARD_NAV: NavItem[] = [
  { href: "/dashboard", label: ar.nav.home, icon: Home, exact: true },
  { href: "/dashboard/pages", label: ar.nav.pages, icon: FileText },
  { href: "/dashboard/orders", label: ar.nav.orders, icon: ShoppingBag, badgeKey: "orders" },
  { href: "/dashboard/products", label: ar.nav.products, icon: Package },
  { href: "/dashboard/offers", label: ar.nav.offers, icon: BadgePercent },
  { href: "/dashboard/discount-codes", label: ar.nav.discountCodes, icon: Tag },
  { href: "/dashboard/identities", label: ar.nav.identities, icon: Fingerprint },
  { href: "/dashboard/media", label: ar.nav.media, icon: Images },
  { href: "/dashboard/domains", label: ar.nav.domains, icon: Globe },
  { href: "/dashboard/settings", label: ar.nav.settings, icon: Settings },
];

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: ar.admin.nav.overview, icon: LayoutDashboard, exact: true },
  { href: "/admin/tenants", label: ar.admin.nav.tenants, icon: Building2 },
  { href: "/admin/themes", label: ar.admin.nav.themes, icon: Palette },
];
