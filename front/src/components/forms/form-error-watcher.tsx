"use client";

import * as React from "react";
import { toast } from "@/components/ui/feedback";
import { FORM_ERRORS_EVENT } from "@/lib/api/errors";
import "@/lib/zod-ar";
import { ar } from "@/messages/ar";

/** A field the form marked wrong: an invalid control, or a field's error line. */
const INVALID = '[aria-invalid="true"], [role="alert"][data-field-error]';

/** The first wrong field of a form (or of the page), in reading order. */
function firstInvalid(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(INVALID);
}

/** Scrolls to the first wrong field and puts the cursor in it, so a long form never hides its error above. */
export function revealFirstError(root: ParentNode = document): boolean {
  const target = firstInvalid(root);
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  const control = target.matches("input, textarea, select, button, [tabindex]")
    ? target
    : target.closest("div")?.querySelector<HTMLElement>('input, textarea, select, button[role="combobox"], [tabindex]:not([tabindex="-1"])');
  control?.focus({ preventScroll: true });
  return true;
}

/**
 * Mounted once (root layout). Whenever a form is sent with something wrong — checked in the
 * browser, or refused by the server (applyServerErrors fires FORM_ERRORS_EVENT) — a toast says so
 * and the page scrolls to the first wrong field. No form needs to do anything for it.
 */
export function FormErrorWatcher() {
  React.useEffect(() => {
    let last = 0;
    const announce = (root: ParentNode) => {
      if (!revealFirstError(root)) return;
      // One toast per attempt, even when both the browser and the server report.
      const now = Date.now();
      if (now - last < 800) return;
      last = now;
      toast.error(ar.errors.formInvalid);
    };

    // Checks done in the browser show their errors right after the submit event.
    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      window.setTimeout(() => announce(form), 120);
    };
    const onServer = () => window.setTimeout(() => announce(document), 60);

    document.addEventListener("submit", onSubmit, true);
    window.addEventListener(FORM_ERRORS_EVENT, onServer);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener(FORM_ERRORS_EVENT, onServer);
    };
  }, []);

  return null;
}
