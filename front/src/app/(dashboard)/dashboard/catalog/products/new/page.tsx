import type { Metadata } from "next";
import { ProductForm } from "@/features/catalog/products/product-form";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.catalog.form.newTitle };

export default function Page() {
  return <ProductForm product={null} />;
}
