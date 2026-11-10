import { UsageMeter } from "@/components/billing/plan";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ar } from "@/messages/ar";
import { ProductsList } from "./products-list";

export const metadata: Metadata = { title: ar.products.title };

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        title={ar.products.title}
        description={ar.products.description}
        actions={
          <>
            <UsageMeter limit="products" />
            <Button asChild>
            <Link href="/dashboard/products/new">
              <Plus />
                {ar.products.new}
              </Link>
            </Button>
          </>
        }
      />
      <ProductsList />
    </>
  );
}
