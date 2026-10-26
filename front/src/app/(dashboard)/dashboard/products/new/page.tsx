import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ar } from "@/messages/ar";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: ar.products.new };

export default function NewProductPage() {
  return (
    <>
      <PageHeader title={ar.products.new} />
      <ProductForm />
    </>
  );
}
