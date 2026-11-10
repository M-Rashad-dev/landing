"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Gift, Palette } from "lucide-react";
import { useState } from "react";
import { ErrorState } from "@/components/dashboard/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { grantTheme, revokeTheme, themeCatalogKeys, useAdminThemeCatalog, useTenantThemes } from "@/lib/admin/api";
import { errorMessage } from "@/lib/api/errors";
import { formatCairo } from "@/lib/dates";
import { formatPrice } from "@/lib/price";
import { ar } from "@/messages/ar";

const c = ar.admin.themeCatalog;

/** Paid themes this store owns; the admin can give one or take back its own gifts. */
export function TenantThemesCard({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useTenantThemes(id);
  const catalog = useAdminThemeCatalog();
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);

  const owned = new Set((data ?? []).map((row) => row.theme_key));
  const giftable = (catalog.data?.themes ?? []).filter((theme) => !theme.is_free && !owned.has(theme.key));

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: themeCatalogKeys.tenant(id) });
      void queryClient.invalidateQueries({ queryKey: themeCatalogKeys.list });
      toast.success(message);
      setChoice("");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Palette className="size-5 text-gold" aria-hidden />
          {c.grantTitle}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Select className="w-44" aria-label={c.grant} value={choice} onChange={(e) => setChoice(e.target.value)} placeholder="—" options={giftable.map((theme) => ({ value: theme.key, label: theme.name }))} />
          <Button size="sm" disabled={!choice || busy} onClick={() => run(() => grantTheme(id, choice, null), c.granted)}>
            <Gift />
            {c.grant}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isPending || !data ? (
          <Skeleton className="h-16" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{c.noneOwned}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.map((row) => (
              <li key={row.theme_key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{row.name}</span>
                  <Badge variant={row.source === "purchase" ? "success" : "info"}>{c.sources[row.source]}</Badge>
                  {row.price_paid > 0 ? <span className="text-muted-foreground">{formatPrice(row.price_paid)}</span> : null}
                  <span className="text-xs text-muted-foreground">{formatCairo(row.created_at, { withTime: false })}</span>
                </span>
                {row.source === "admin_grant" ? (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => revokeTheme(id, row.theme_key), c.revoked)}>
                    {c.revoke}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
