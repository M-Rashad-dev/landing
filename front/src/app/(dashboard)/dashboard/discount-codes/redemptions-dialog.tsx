"use client";

import { useState } from "react";
import { Pagination } from "@/components/dashboard/data-table";
import { ErrorState } from "@/components/dashboard/error-state";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCairo } from "@/lib/dates";
import { formatPhoneLocal } from "@/lib/format/phone";
import { formatPrice } from "@/lib/price";
import { useRedemptions } from "@/lib/promotions/api";
import type { DiscountCode } from "@/lib/types";
import { ar } from "@/messages/ar";

const t = ar.codes;

export function RedemptionsDialog({ code, onClose }: { code: DiscountCode | null; onClose: () => void }) {
  return (
    <Dialog open={code !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">{code ? <RedemptionsBody key={code.id} code={code} /> : null}</DialogContent>
    </Dialog>
  );
}

function RedemptionsBody({ code }: { code: DiscountCode }) {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useRedemptions(code.id, page);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t.redemptions} — <span dir="ltr">{code.code}</span>
        </DialogTitle>
      </DialogHeader>
      <DialogBody>
        {isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : data.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t.redemptionsEmpty}</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.order}</TableHead>
                  <TableHead>{t.phone}</TableHead>
                  <TableHead>{t.amount}</TableHead>
                  <TableHead>{t.date}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell dir="ltr" className="text-start">
                      #{r.order_number ?? r.order_id}
                    </TableCell>
                    <TableCell dir="ltr" className="text-start">
                      {formatPhoneLocal(r.phone)}
                    </TableCell>
                    <TableCell>
                      {formatPrice(r.amount)} {r.released_at ? <Badge variant="secondary">{t.released}</Badge> : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatCairo(r.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </DialogBody>
    </>
  );
}
