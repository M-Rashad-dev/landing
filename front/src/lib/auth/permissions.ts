/**
 * What a signed-in person may open and do (back: App\Auth\PermissionCatalog). The owner gets ["*"]; staff get the
 * keys they were given («page.action»). The server checks every request; this only hides what would be refused.
 */

export const ALL = "*";

/** The permission that opens each dashboard page (longest prefix wins). Pages not listed are open to everyone. */
const PAGES: Array<[string, string]> = [
  ["/dashboard/copilot", "copilot.use"],
  ["/dashboard/orders/confirm", "orders.confirm"],
  ["/dashboard/orders/refunds", "orders.refunds"],
  ["/dashboard/orders", "orders.view"],
  ["/dashboard/abandoned", "abandoned.view"],
  ["/dashboard/customers", "customers.view"],
  ["/dashboard/reviews", "reviews.view"],
  ["/dashboard/catalog/products/import", "products.import"],
  ["/dashboard/catalog/products/new", "products.create"],
  ["/dashboard/catalog/products", "products.view"],
  ["/dashboard/catalog/categories", "categories.view"],
  ["/dashboard/catalog/spec-groups/new", "products.create"],
  ["/dashboard/catalog/spec-groups", "products.view"],
  ["/dashboard/shipping", "shipping.view"],
  ["/dashboard/store", "store.view"],
  ["/dashboard/design/pages", "store_pages.view"],
  ["/dashboard/design", "design.view"],
  ["/dashboard/marketing/offers", "offers.view"],
  ["/dashboard/marketing/coupons", "coupons.view"],
  ["/dashboard/marketing/upsells", "upsells.view"],
  ["/dashboard/marketing/landings", "landings.view"],
  ["/dashboard/landings", "landings.update"],
  ["/dashboard/analytics", "analytics.view"],
  ["/dashboard/profit", "profit.view"],
  ["/dashboard/settings/domains", "domains.view"],
  ["/dashboard/settings/billing", "billing.view"],
  ["/dashboard/settings/ai", "ai_wallet.view"],
  ["/dashboard/settings/pixels", "pixels.view"],
  ["/dashboard/settings/integrations", "integrations.view"],
  ["/dashboard/settings/payments", "payments.view"],
  ["/dashboard/settings/emails", "emails.view"],
  ["/dashboard/settings/staff", "staff.view"],
  ["/dashboard/settings/activity", "activity.view"],
];

export function can(permissions: readonly string[] | undefined, key: string): boolean {
  if (!permissions) return true;
  return permissions.includes(ALL) || permissions.includes(key);
}

/** The permission a page needs, or null when anyone signed in may open it. */
export function pagePermission(pathname: string): string | null {
  if (pathname === "/dashboard") return "home.view";
  let best: [string, string] | null = null;
  for (const entry of PAGES) {
    if ((pathname === entry[0] || pathname.startsWith(`${entry[0]}/`)) && (!best || entry[0].length > best[0].length)) best = entry;
  }
  return best ? best[1] : null;
}

export function canOpen(permissions: readonly string[] | undefined, pathname: string): boolean {
  const key = pagePermission(pathname);
  return key === null || can(permissions, key);
}
