"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Info } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PRICING_PATH } from "@/components/billing/plan";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/api/errors";
import { checkoutItemFrom, placeCheckout, useCheckoutPreview, type CheckoutItem } from "@/lib/billing/payments";
import { ar } from "@/messages/ar";
import { PayCard, SummaryCard, SupportCard, invoiceItem } from "../invoices/[id]/invoice-view";

const t = ar.billing.checkout;

export function CheckoutView() {
  const item = checkoutItemFrom(useSearchParams());
  const { data, isPending, isError, error, refetch } = useCheckoutPreview(item);
  const back = item?.type === "theme" ? `/dashboard/themes/${encodeURIComponent(item.theme_key)}` : PRICING_PATH;

  const header = (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href={back}>
          <ArrowRight />
          {t.back}
        </Link>
      </Button>
      <PageHeader title={data ? `${t.title}: ${invoiceItem(data.invoice)}` : t.title} description={t.hint} />
    </>
  );

  if (!item) {
    return (
      <>
        {header}
        <EmptyState icon={Info} title={t.invalid} action={<Button asChild><Link href={PRICING_PATH}>{ar.billing.seePlans}</Link></Button>} />
      </>
    );
  }
  if (isError) {
    return (
      <>
        {header}
        <ErrorState error={error} onRetry={() => refetch()} />
      </>
    );
  }
  if (isPending || !data) {
    return (
      <>
        {header}
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">{data.invoice.total > 0 ? <Pay item={item} invoice={data.invoice} /> : <FreeConfirm item={item} />}</div>
        <div className="flex flex-col gap-6">
          <SummaryCard invoice={data.invoice} />
          {data.support.email || data.support.whatsapp ? <SupportCard support={data.support} /> : null}
        </div>
      </div>
    </>
  );
}

function Pay({ item, invoice }: { item: CheckoutItem; invoice: Parameters<typeof PayCard>[0]["invoice"] }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function pay(body: FormData) {
    const created = await placeCheckout(item, body);
    await queryClient.invalidateQueries({ queryKey: ["billing"] });
    toast.success(ar.billing.invoices.sent);
    router.push(`/dashboard/billing/invoices/${created.id}`);
  }

  return <PayCard invoice={invoice} onPay={pay} />;
}

/** The credit covers everything: one click starts the plan (no transfer, no receipt). */
function FreeConfirm({ item }: { item: CheckoutItem }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const created = await placeCheckout(item);
      await queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success(t.activated);
      router.push(`/dashboard/billing/invoices/${created.id}`);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Card className="flex items-start gap-4 p-6">
      <CheckCircle2 className="size-8 shrink-0 text-success" aria-hidden />
      <div>
        <p className="font-display text-lg font-bold">{t.freeTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.freeText}</p>
        <Button className="mt-4" onClick={() => void confirm()} loading={busy}>
          {t.confirmFree}
        </Button>
      </div>
    </Card>
  );
}
