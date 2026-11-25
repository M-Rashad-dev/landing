import { CheckCircle2, Clock } from "lucide-react";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { OrderRefundNote } from "@/lib/store/types";
import { ar } from "@/messages/ar";

const t = ar.refunds.public;

/** Money the store sent back to the customer (done) or is sending back (asked), on the tracking and order pages. */
export function RefundNotes({ refunds }: { refunds?: OrderRefundNote[] }) {
  if (!refunds || refunds.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="as-sm font-bold">{t.title}</p>
      <ul className="flex flex-col gap-2">
        {refunds.map((r, i) => (
          <li key={i} className={`as-sm flex items-start gap-2 rounded-lg p-3 ${r.status === "done" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
            {r.status === "done" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <span>
              {r.status === "done" ? t.done(formatMoney(r.amount), r.method) : t.pending(formatMoney(r.amount))}
              {r.done_at ? <span className="as-xs ms-1 opacity-75">({formatDateTime(r.done_at)})</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
