/** Plans and entitlements (back: App\Billing). Limits: null = unlimited in plan values. */

export type AccessState = "active" | "grace" | "expired";
export type BillingPeriod = "monthly" | "yearly";

export const PLAN_LIMITS = ["products", "landing_pages", "custom_domains", "media_storage_mb", "offers", "discount_codes", "webhooks", "ab_tests"] as const;
export const PLAN_FEATURES = ["upsells", "abandoned_leads", "advanced_analytics", "remove_branding"] as const;

export type PlanLimitKey = (typeof PLAN_LIMITS)[number];
export type PlanFeatureKey = (typeof PLAN_FEATURES)[number];

/** Sent with the session (/auth/me) and by billing/entitlements. */
export type Entitlements = {
  state: AccessState;
  plan: { key: string; name: string } | null;
  period: BillingPeriod | null;
  is_trial: boolean;
  ends_at: string | null;
  grace_ends_at: string | null;
  days_left: number | null;
  renewal_due: boolean;
  features: Record<PlanFeatureKey, boolean>;
  limits: Record<PlanLimitKey, { limit: number; unlimited: boolean }>;
};

export type UsageRow = { key: PlanLimitKey; label: string; used: number; limit: number; unlimited: boolean; locked: number };

export type EntitlementInfo = { key: PlanLimitKey | PlanFeatureKey; kind: "limit" | "feature"; label: string };

export type PlanQuote = {
  plan_key: string;
  period: BillingPeriod;
  original: number;
  discount_percent: number;
  final: number;
  discount_ends_at: string | null;
  is_current?: boolean;
  change?: { pay: number; credit: number; starts_now: boolean };
};

export type PlanValues = Record<PlanLimitKey, number | null> & Record<PlanFeatureKey, boolean>;

export type PricingPlan = {
  key: string;
  name: string;
  tagline: string | null;
  description: string | null;
  marketing_points: string[];
  is_highlighted: boolean;
  prices: Partial<Record<BillingPeriod, PlanQuote>>;
  values: PlanValues;
};

export type SubscriptionRow = {
  id: number;
  plan: { key: string; name: string };
  period: BillingPeriod | null;
  source: "trial" | "payment" | "admin_grant";
  status: "active" | "replaced" | "refunded" | "cancelled";
  starts_at: string;
  ends_at: string;
  amount_paid: number;
  is_trial: boolean;
};

export type LockRow = { id: number; label: string; locked: boolean; updated_at: string | null };

/** Error codes the API uses when the plan blocks something. */
export const PLAN_ERROR_CODES = ["plan_limit_reached", "plan_feature_locked", "subscription_expired"] as const;
export type PlanErrorCode = (typeof PLAN_ERROR_CODES)[number];

export type PlanBlock = {
  code: PlanErrorCode;
  message: string;
  limit_key?: PlanLimitKey;
  limit?: number;
  used?: number;
  feature?: PlanFeatureKey;
  upgrade_to?: { key: string; name: string } | null;
};
