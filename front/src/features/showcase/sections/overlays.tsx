"use client";

import { AlertTriangle, Archive, Copy, Eye, Info, MoreVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTrigger, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import { DEMO_ORDERS } from "../fixtures";
import { ShowSection, Specimen } from "../frame";
import { OrderDrawer } from "./order-drawer";

const o = ar.showcase.overlays;

export function OverlaysSection() {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [drawer, setDrawer] = useState(false);

  return (
    <ShowSection id="overlays" title={ar.showcase.sections.overlays.title} description={ar.showcase.sections.overlays.description}>
      <Specimen label={o.modal}>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{o.modal}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader title={o.modalTitle} description={o.modalDescription} />
            <DialogBody className="flex flex-col gap-4">
              <Field label={ar.showcase.inputs.text} htmlFor="dlg-name" required>
                <Input id="dlg-name" />
              </Field>
              <Field label={ar.showcase.inputs.textarea} htmlFor="dlg-desc" optional>
                <Textarea id="dlg-desc" rows={3} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline">{ar.common.cancel}</Button>
              <Button>{ar.common.save}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button variant="danger-ghost" onClick={() => setConfirm(true)}>
          <Trash2 />
          {o.confirm}
        </Button>
        <Button variant="outline" onClick={() => setDrawer(true)}>
          {o.drawer}
        </Button>
      </Specimen>

      <Specimen label={o.menu}>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label={ar.common.actions}>
              <MoreVertical />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuLabel>#1028</MenuLabel>
            <MenuItem>
              <Eye />
              {o.menuItems.view}
            </MenuItem>
            <MenuItem>
              <Copy />
              {o.menuItems.duplicate}
            </MenuItem>
            <MenuItem disabled>
              <Archive />
              {o.menuItems.archive}
            </MenuItem>
            <MenuSeparator />
            <MenuItem destructive>
              <Trash2 />
              {o.menuItems.delete}
            </MenuItem>
          </MenuContent>
        </Menu>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Info />
              {o.popover}
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <p className="text-sm">{o.popoverText}</p>
          </PopoverContent>
        </Popover>
        <Tooltip content={o.tooltipText}>
          <Button variant="ghost">
            <AlertTriangle className="text-warning" />
            {o.tooltip}
          </Button>
        </Tooltip>
      </Specimen>

      <Specimen label={o.toasts}>
        <Button variant="outline" onClick={() => toast.success(o.toastSuccessText)}>
          {o.toastSuccess}
        </Button>
        <Button variant="outline" onClick={() => toast.error(o.toastErrorText)}>
          {o.toastError}
        </Button>
        <Button variant="outline" onClick={() => toast.info(o.toastInfoText)}>
          {o.toastInfo}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const id = toast.loading(o.toastLoadingText);
            window.setTimeout(() => toast.success(o.toastDone, { id }), 1500);
          }}
        >
          {o.toastLoading}
        </Button>
      </Specimen>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={o.confirmTitle}
        description={o.confirmText}
        confirmLabel={ar.common.delete}
        destructive
        loading={deleting}
        onConfirm={() => {
          setDeleting(true);
          window.setTimeout(() => {
            setDeleting(false);
            setConfirm(false);
            toast.success(o.deleted);
          }, 700);
        }}
      />
      <OrderDrawer order={drawer ? DEMO_ORDERS[0] : null} onClose={() => setDrawer(false)} />
    </ShowSection>
  );
}
