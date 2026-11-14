import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsPage } from "@/features/catalog/products/products-page";
import { ar } from "@/messages/ar";

export const metadata: Metadata = { title: ar.catalog.products.title };

export default function Page() {
  return (
    <Suspense>
      <ProductsPage />
    </Suspense>
  );
}
