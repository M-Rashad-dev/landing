import "server-only";
import { laravelFetch } from "@/lib/api/server";
import type { Support } from "@/lib/billing/payments";
import type { EntitlementInfo, PricingPlan } from "@/lib/billing/types";

export type PublicPlans = { plans: PricingPlan[]; entitlements: EntitlementInfo[]; support: Support };

/** Public plans + support contact (cached 60 s). Null when the API is down: pages render without them. */
export async function loadPublicPlans(): Promise<PublicPlans | null> {
  try {
    const response = await laravelFetch("/plans", { auth: false, cache: "force-cache", next: { revalidate: 60, tags: ["plans"] } });
    if (!response.ok) return null;
    const json = (await response.json()) as { data: PricingPlan[]; meta: { entitlements: EntitlementInfo[]; support?: Support } };
    return { plans: json.data, entitlements: json.meta.entitlements, support: json.meta.support ?? { email: null, whatsapp: null } };
  } catch {
    return null;
  }
}
