import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";
import type { Product } from "@/lib/types";
import { ar } from "@/messages/ar";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: ar.products.edit };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  let product: Product;
  try {
    product = await serverApi<Product>(`/dashboard/products/${id}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <PageHeader title={ar.products.edit} description={product.name} />
      <ProductForm key={product.updated_at ?? product.id} product={product} />
    </>
  );
}
