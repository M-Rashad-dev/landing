import { headers } from "next/headers";
import { laravelFetch } from "@/lib/api/server";
import type { EntitlementInfo, PricingPlan } from "@/lib/billing/types";
import { MarketingPage } from "./marketing-page";

/** Public plans for the pricing section; the page still renders without them when the API is down. */
async function loadPricing(): Promise<{ plans: PricingPlan[]; entitlements: EntitlementInfo[] } | null> {
  try {
    const response = await laravelFetch("/plans", { auth: false, cache: "force-cache", next: { revalidate: 60, tags: ["plans"] } });
    if (!response.ok) return null;
    const json = (await response.json()) as { data: PricingPlan[]; meta: { entitlements: EntitlementInfo[] } };
    return json.data.length ? { plans: json.data, entitlements: json.meta.entitlements } : null;
  } catch {
    return null;
  }
}

/** Platform home page (PLATFORM_DOMAIN). Links point to the app host. */
export default async function Home() {
  const appHost = (process.env.APP_HOST ?? "app.localhost").toLowerCase();
  const requestHost = (await headers()).get("host") ?? "";
  const port = requestHost.includes(":") ? requestHost.slice(requestHost.lastIndexOf(":")) : "";
  const isLocal = appHost.endsWith("localhost");
  const appUrl = isLocal ? `http://${appHost}${port}` : `https://${appHost}`;

  return <MarketingPage appUrl={appUrl} pricing={await loadPricing()} />;
}
