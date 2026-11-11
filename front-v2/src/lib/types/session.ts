/** Shapes of /auth/me (dates are ISO 8601 UTC strings). */

export type UserRole = "owner" | "super_admin";

export type User = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  last_login_at: string | null;
};

export type Tenant = {
  id: number;
  name: string;
  status: "active" | "suspended";
  created_at: string | null;
};

export type AccessState = "active" | "grace" | "expired";

/** The store's plan right now. Features and limits are read by the screens that need them. */
export type Entitlements = {
  state: AccessState;
  plan: { key: string; name: string } | null;
  period: "monthly" | "yearly" | null;
  is_trial: boolean;
  ends_at: string | null;
  grace_ends_at: string | null;
  days_left: number | null;
  renewal_due: boolean;
  features: Record<string, boolean>;
  limits: Record<string, { limit: number; unlimited: boolean }>;
};

/** How public sites are reached (production: https, no port; local: http + 3000). */
export type PublicOrigin = { scheme: "http" | "https"; port: string };

export type Session = {
  user: User;
  tenant: Tenant | null;
  primary_host: string | null;
  /** Null for the platform admin. */
  plan: Entitlements | null;
  public_origin: PublicOrigin;
};
