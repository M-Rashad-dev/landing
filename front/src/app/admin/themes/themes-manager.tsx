"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Palette } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { adminKeys, setThemeActive, useAdminThemes, type AdminTheme } from "@/lib/admin/api";
import { errorMessage } from "@/lib/api/errors";
import { ar } from "@/messages/ar";

const t = ar.admin.themes;

export function ThemesManager() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useAdminThemes();
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(theme: AdminTheme, isActive: boolean) {
    setSaving(theme.key);
    try {
      const updated = await setThemeActive(theme.key, isActive);
      queryClient.setQueryData<AdminTheme[]>(adminKeys.themes, (list) => list?.map((item) => (item.key === updated.key ? updated : item)));
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }
  if (data.length === 0) return <EmptyState icon={Palette} title={ar.common.noResults} />;

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {data.map((theme) => (
        <li key={theme.key}>
          <Card className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="font-bold">{theme.name}</p>
              <p className="text-xs text-muted-foreground">
                <span dir="ltr">{theme.key}</span> · {t.pages(theme.pages_count)}
              </p>
            </div>
            <Switch checked={theme.is_active} disabled={saving === theme.key} onCheckedChange={(checked) => toggle(theme, checked)} aria-label={t.toggle(theme.name)} />
          </Card>
        </li>
      ))}
    </ul>
  );
}
