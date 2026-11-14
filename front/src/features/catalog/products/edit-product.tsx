"use client";

import { notFound } from "next/navigation";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useProduct } from "./api";
import { ProductForm } from "./product-form";

/** Loads the product then opens the form (keyed by id so switching products starts clean). */
export function EditProduct({ id }: { id: number }) {
  const query = useProduct(Number.isInteger(id) && id > 0 ? id : null);

  if (!Number.isInteger(id) || id <= 0 || (query.isError && isApiError(query.error) && query.error.status === 404)) notFound();
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} message={errorMessage(query.error)} />;
  return <ProductForm key={query.data.id} product={query.data} />;
}
