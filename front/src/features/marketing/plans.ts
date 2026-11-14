import "server-only";
import { serverEnv } from "@/lib/env";

export type PlanPrice = { original: number; discount_percent: number; final: number; discount_ends_at: string | null };
export type PublicPlan = {
  key: string;
  name: string;
  tagline: string | null;
  is_highlighted: boolean;
  prices: { monthly?: PlanPrice; yearly?: PlanPrice };
  values: Record<string, number | boolean | null>;
};
export type PricingData = { plans: PublicPlan[]; support: { email: string | null; whatsapp: string | null } };

/** Cache of the pricing data; the admin's plan edits show within this many seconds. */
export const PLANS_REVALIDATE = 300;

/** The public plans and the support contacts (same data as the billing). Null when Laravel is unreachable. */
export async function pricingData(): Promise<PricingData | null> {
  const env = serverEnv();
  try {
    const response = await fetch(`${env.laravelUrl}/api/v1/plans`, { headers: { Accept: "application/json" }, next: { revalidate: PLANS_REVALIDATE, tags: ["plans"] } });
    if (!response.ok) return null;
    const json = (await response.json()) as { data: PublicPlan[]; meta?: { support?: PricingData["support"] } };
    return { plans: json.data, support: { email: json.meta?.support?.email ?? null, whatsapp: json.meta?.support?.whatsapp ?? null } };
  } catch {
    return null;
  }
}

/** Links into the app (sign up, sign in) from the platform domain. */
export function appUrl(path: string): string {
  const env = serverEnv();
  const port = env.publicPort ? `:${env.publicPort}` : "";
  return `${env.publicScheme}://${env.appHost}${port}${path}`;
}

/** The platform site (where the platform pages live), e.g. for "open the page" links in the admin. */
export function platformUrl(path = ""): string {
  const env = serverEnv();
  const port = env.publicPort ? `:${env.publicPort}` : "";
  return `${env.publicScheme}://${env.platformDomain}${port}${path}`;
}

/** "01094062024" → "https://wa.me/201094062024". */
export function whatsappUrl(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("0") ? `2${digits}` : digits}`;
}
