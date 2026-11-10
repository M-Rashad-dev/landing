"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Palette, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { ThemeCover, ThemePriceTag } from "@/components/themes/theme-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { setThemeActive, themeCatalogKeys, useAdminThemeCatalog, type AdminThemeRow } from "@/lib/admin/api";
import { errorMessage } from "@/lib/api/errors";
import { ar } from "@/messages/ar";

const t = ar.admin.themes;
const c = ar.admin.themeCatalog;

export function ThemesManager() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useAdminThemeCatalog();
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(theme: AdminThemeRow, isActive: boolean) {
    setSaving(theme.key);
    try {
      await setThemeActive(theme.key, isActive);
      await queryClient.invalidateQueries({ queryKey: themeCatalogKeys.list });
      toast.success(isActive ? t.enabled : t.disabled);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    );
  }
  if (data.themes.length === 0) return <EmptyState icon={Palette} title={ar.common.noResults} />;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.themes.map((theme) => (
        <li key={theme.key}>
          <Card className="flex h-full flex-col overflow-hidden p-0">
            <ThemeCover theme={theme} className="border-b" />
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{theme.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span dir="ltr">{theme.key}</span> · {t.pages(theme.pages_count)} · {c.sales(theme.sales)}
                  </p>
                </div>
                <Switch checked={theme.is_active} disabled={saving === theme.key} onCheckedChange={(checked) => toggle(theme, checked)} aria-label={t.toggle(theme.name)} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ThemePriceTag theme={theme} />
                <Badge variant="secondary">{ar.themeStore.kinds[theme.kind]}</Badge>
                {!theme.is_listed ? <Badge variant="outline">{ar.admin.plans.hidden}</Badge> : null}
              </div>
              <Button variant="outline" size="sm" className="mt-auto self-start" asChild>
                <Link href={`/admin/themes/${theme.key}`}>
                  <Pencil />
                  {c.edit}
                </Link>
              </Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
