import {
  BarChart3,
  Blocks,
  FileText,
  FolderTree,
  Gift,
  Home,
  LayoutTemplate,
  ListTree,
  Megaphone,
  Package,
  Palette,
  Settings,
  Store,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  TicketPercent,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ar } from "@/messages/ar";

const t = ar.nav;

/**
 * "ready" pages are open; "soon" pages show locked in the sidebar until their part is built.
 * Opening a part = changing its status here (docs/frontend-v2/HANDOFF.md tracks which part is next).
 */
export type NavStatus = "ready" | "soon";

export type NavItem = { href: string; label: string; icon: LucideIcon; status: NavStatus; exact?: boolean; badge?: number };
export type NavGroup = { label?: string; items: NavItem[] };

export const DASHBOARD_NAV: NavGroup[] = [
  { items: [{ href: "/dashboard", label: t.items.home, icon: Home, status: "ready", exact: true }] },
  {
    label: t.groups.sales,
    items: [
      { href: "/dashboard/orders", label: t.items.orders, icon: ShoppingBag, status: "ready" },
      { href: "/dashboard/abandoned", label: t.items.abandoned, icon: ShoppingCart, status: "ready" },
      { href: "/dashboard/customers", label: t.items.customers, icon: Users, status: "ready" },
      { href: "/dashboard/reviews", label: t.items.reviews, icon: Star, status: "ready" },
    ],
  },
  {
    label: t.groups.store,
    items: [
      { href: "/dashboard/catalog/products", label: t.items.products, icon: Package, status: "ready" },
      { href: "/dashboard/catalog/categories", label: t.items.categories, icon: FolderTree, status: "ready" },
      { href: "/dashboard/shipping", label: t.items.shipping, icon: Truck, status: "ready" },
      { href: "/dashboard/store", label: t.items.storeSettings, icon: Store, status: "ready" },
    ],
  },
  {
    label: t.groups.design,
    items: [
      { href: "/dashboard/design/theme", label: t.items.themeHome, icon: Palette, status: "ready" },
      { href: "/dashboard/design/menus", label: t.items.menus, icon: ListTree, status: "soon" },
      { href: "/dashboard/design/pages", label: t.items.storePages, icon: FileText, status: "soon" },
      { href: "/dashboard/design/identity", label: t.items.identity, icon: LayoutTemplate, status: "soon" },
    ],
  },
  {
    label: t.groups.marketing,
    items: [
      { href: "/dashboard/marketing/offers", label: t.items.offers, icon: Tag, status: "ready" },
      { href: "/dashboard/marketing/coupons", label: t.items.coupons, icon: TicketPercent, status: "ready" },
      { href: "/dashboard/marketing/upsells", label: t.items.upsells, icon: Gift, status: "soon" },
      { href: "/dashboard/marketing/landings", label: t.items.landings, icon: Megaphone, status: "soon" },
    ],
  },
  { label: t.groups.insights, items: [{ href: "/dashboard/analytics", label: t.items.analytics, icon: BarChart3, status: "soon" }] },
];

/** Pinned at the bottom of the sidebar. */
export const DASHBOARD_FOOTER_NAV: NavItem[] = [
  { href: "/dashboard/settings", label: t.items.settings, icon: Settings, status: "ready" },
  { href: "/dashboard/components", label: t.items.components, icon: Blocks, status: "ready" },
];

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
