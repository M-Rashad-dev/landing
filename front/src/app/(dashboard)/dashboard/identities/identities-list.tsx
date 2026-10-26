"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Fingerprint, MoreVertical, Pencil, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorState } from "@/components/dashboard/error-state";
import { MediaThumb } from "@/components/shared/media/media-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { fontDef } from "@/lib/fonts";
import { deleteIdentity, identityKeys, makeIdentityDefault, useIdentities } from "@/lib/identity/api";
import type { Identity } from "@/lib/types";
import { ar } from "@/messages/ar";

const SWATCHES = ["primary", "secondary", "accent", "background", "foreground"] as const;

export function IdentitiesList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useIdentities();
  const [deleting, setDeleting] = useState<Identity | null>(null);
  const [blockedBy, setBlockedBy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function makeDefault(identity: Identity) {
    try {
      await makeIdentityDefault(identity.id);
      await queryClient.invalidateQueries({ queryKey: identityKeys.all });
      toast.success(ar.identities.madeDefault);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteIdentity(deleting.id);
      await queryClient.invalidateQueries({ queryKey: identityKeys.all });
      toast.success(ar.identities.deleted);
      setDeleting(null);
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        const pages = (err.body.pages as Array<{ title: string }> | undefined) ?? [];
        setBlockedBy(pages.length ? `${err.message} ${pages.map((page) => page.title).join("، ")}` : err.message);
        setDeleting(null);
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data.data.length) {
    return (
      <EmptyState
        icon={Fingerprint}
        title={ar.identities.emptyTitle}
        description={ar.identities.emptyText}
        action={
          <Button asChild>
            <Link href="/dashboard/identities/new">{ar.identities.new}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.data.map((identity) => (
          <li key={identity.id}>
            <Card className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <div className="size-12 shrink-0 overflow-hidden rounded-lg border">
                  <MediaThumb media={identity.logo} className="rounded-none" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/identities/${identity.id}`} className="block truncate font-bold hover:underline">
                    {identity.name}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">{identity.brand_name}</p>
                </div>
                {identity.is_default ? (
                  <Badge>
                    <Star />
                    {ar.identities.default}
                  </Badge>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={ar.common.actions}>
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => router.push(`/dashboard/identities/${identity.id}`)}>
                      <Pencil />
                      {ar.common.edit}
                    </DropdownMenuItem>
                    {!identity.is_default ? (
                      <DropdownMenuItem onSelect={() => makeDefault(identity)}>
                        <Star />
                        {ar.identities.makeDefault}
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem destructive disabled={identity.is_default} onSelect={() => setDeleting(identity)}>
                      <Trash2 />
                      {ar.common.delete}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-1.5" aria-hidden>
                {SWATCHES.map((key) => (
                  <span key={key} className="size-7 rounded-full border shadow-sm" style={{ background: identity.colors[key] }} />
                ))}
              </div>
              <p className="mt-auto text-xs text-muted-foreground">
                {fontDef(identity.font_heading).family} · {fontDef(identity.font_body).family}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={ar.identities.deleteTitle}
        description={ar.identities.deleteText}
        confirmLabel={ar.common.delete}
        destructive
        loading={busy}
        onConfirm={confirmDelete}
      />
      <ConfirmDialog open={blockedBy !== null} onOpenChange={(open) => !open && setBlockedBy(null)} title={ar.identities.deleteTitle} description={blockedBy ?? ""} confirmLabel={ar.common.close} onConfirm={() => setBlockedBy(null)} />
    </>
  );
}
