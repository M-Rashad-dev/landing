import type { Metadata } from "next";
import { AdminHome } from "@/features/admin/home-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.admin.home.title };

export default function AdminHomePage() {
  return <AdminHome />;
}
