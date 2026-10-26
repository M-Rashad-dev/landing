"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PageRef } from "@/lib/types";
import { ar } from "@/messages/ar";

/** Shown after a 409: lists the pages that still use the item, with links to their settings. */
export function InUseDialog({ pages, title, text, onClose }: { pages: PageRef[] | null; title: string; text: string; onClose: () => void }) {
  return (
    <Dialog open={pages !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="mb-3 text-sm text-muted-foreground">{text}</p>
          <ul className="flex flex-col gap-2">
            {pages?.map((page) => (
              <li key={page.id}>
                <Link href={`/dashboard/pages/${page.id}`} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
                  {page.title}
                  <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>{ar.common.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
