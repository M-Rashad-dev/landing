import type { ProductSpecTable } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";

const t = ar.specs.storefront;

/**
 * «المواصفات» on a product page, for every store theme (docs/plans/tekno/PLAN.md §1.7): each table under its name as
 * a plain two-column table (label | value), alternate rows tinted from the theme's own colors. Nothing when the
 * product has no filled spec. `titleClass` takes the theme's heading font.
 */
export function ProductSpecs({ specs, titleClass }: { specs: ProductSpecTable[] | undefined; titleClass?: string }) {
  if (!specs || specs.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 border-t pt-5" aria-label={t.title}>
      <h2 className={cn("as-xl", titleClass ?? "font-bold")}>{t.title}</h2>
      {specs.map((table) => (
        <div key={table.name} className="flex flex-col gap-1.5">
          {/* A single table named like the section needs no second heading. */}
          {specs.length === 1 && table.name.trim() === t.title ? null : <h3 className="as-base font-bold">{table.name}</h3>}
          <div className="overflow-hidden rounded-lg border border-(--as-line)">
            <table className="as-sm w-full">
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={row.label} className={cn("border-b border-(--as-line) last:border-b-0", i % 2 === 0 && "bg-(--as-soft)")}>
                    <th scope="row" className="w-2/5 px-3 py-2 text-start align-top font-semibold as-muted">
                      {row.label}
                    </th>
                    <td className="px-3 py-2 align-top font-semibold"><bdi>{row.value}</bdi></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
