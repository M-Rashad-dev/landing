import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/** Platform admin area: the super admin only (a store owner goes back to /dashboard). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.user.role !== "super_admin") redirect("/dashboard");
  return children;
}
