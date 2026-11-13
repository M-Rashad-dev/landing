import {
  BadgeDollarSign,
  BarChart3,
  CreditCard,
  History,
  Layers,
  ReceiptText,
  Undo2,
  Blocks,
  FileText,
  FolderTree,
  Gift,
  Home,
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
      { href: "/dashboard/design/pages", label: t.items.storePages, icon: FileText, status: "ready" },
    ],
  },
  {
    label: t.groups.marketing,
    items: [
      { href: "/dashboard/marketing/offers", label: t.items.offers, icon: Tag, status: "ready" },
      { href: "/dashboard/marketing/coupons", label: t.items.coupons, icon: TicketPercent, status: "ready" },
      { href: "/dashboard/marketing/upsells", label: t.items.upsells, icon: Gift, status: "soon" },
      { href: "/dashboard/marketing/landings", label: t.items.landings, icon: Megaphone, status: "ready" },
    ],
  },
  { label: t.groups.insights, items: [{ href: "/dashboard/analytics", label: t.items.analytics, icon: BarChart3, status: "ready" }] },
];

/** Pinned at the bottom of the sidebar. */
export const DASHBOARD_FOOTER_NAV: NavItem[] = [
  { href: "/dashboard/settings", label: t.items.settings, icon: Settings, status: "ready" },
  { href: "/dashboard/components", label: t.items.components, icon: Blocks, status: "ready" },
];

const a = ar.admin.nav;

/** The platform admin (/admin). */
export const ADMIN_NAV: NavGroup[] = [
  { items: [{ href: "/admin", label: a.items.home, icon: Home, status: "ready", exact: true }] },
  { label: a.groups.stores, items: [{ href: "/admin/stores", label: a.items.stores, icon: Store, status: "ready" }] },
  {
    label: a.groups.money,
    items: [
      { href: "/admin/payments", label: a.items.payments, icon: ReceiptText, status: "ready" },
      { href: "/admin/refunds", label: a.items.refunds, icon: Undo2, status: "ready" },
      { href: "/admin/payment-methods", label: a.items.methods, icon: CreditCard, status: "ready" },
    ],
  },
  {
    label: a.groups.catalog,
    items: [
      { href: "/admin/plans", label: a.items.plans, icon: BadgeDollarSign, status: "ready" },
      { href: "/admin/themes", label: a.items.themes, icon: Layers, status: "ready" },
    ],
  },
];

export const ADMIN_FOOTER_NAV: NavItem[] = [
  { href: "/admin/activity", label: a.items.activity, icon: History, status: "ready" },
  { href: "/admin/settings", label: a.items.settings, icon: Settings, status: "ready" },
];

export type NavArea = "dashboard" | "admin";

/** The sidebar of each area (client components pick it by name: icons cannot cross from the server). */
export function navigationOf(area: NavArea): { groups: NavGroup[]; footer: NavItem[]; home: string } {
  return area === "admin" ? { groups: ADMIN_NAV, footer: ADMIN_FOOTER_NAV, home: "/admin" } : { groups: DASHBOARD_NAV, footer: DASHBOARD_FOOTER_NAV, home: "/dashboard/components" };
}

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
