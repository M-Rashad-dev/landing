/** Shapes returned by the Laravel API (dates are ISO 8601 UTC strings). */

export type User = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: "owner" | "super_admin";
  last_login_at: string | null;
};

export type Tenant = {
  id: number;
  name: string;
  status: "active" | "suspended";
  created_at: string | null;
};

export type Session = {
  user: User;
  tenant: Tenant | null;
  primary_host: string | null;
};
