import type { Metadata } from "next";
import { CategoriesPage } from "@/features/catalog/categories/categories-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.catalog.categories.title };

export default function Page() {
  return <CategoriesPage />;
}
