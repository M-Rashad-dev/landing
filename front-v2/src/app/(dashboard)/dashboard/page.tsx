import { redirect } from "next/navigation";

/** The home is locked until its part is built: open the components page meanwhile. */
export default function DashboardHome() {
  redirect("/dashboard/components");
}
