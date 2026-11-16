import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Toaster } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { FORM_ERRORS_EVENT } from "@/lib/api/errors";
import { ar } from "@/messages/ar";
import { FormErrorWatcher } from "./form-error-watcher";

afterEach(cleanup);

describe("FormErrorWatcher", () => {
  it("toasts and scrolls to the first wrong field when a form is sent with errors", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(
      <>
        <form onSubmit={(e) => e.preventDefault()}>
          <Field label="الاسم" htmlFor="n" error="الخانة دي مطلوبة">
            <input id="n" aria-invalid />
          </Field>
          <button type="submit">حفظ</button>
        </form>
        <FormErrorWatcher />
        <Toaster />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));

    expect(await screen.findByText(ar.errors.formInvalid)).toBeInTheDocument();
    expect(scroll).toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("الاسم")));
  });

  it("does the same for errors the server put on fields", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(
      <>
        <Field label="الإيميل" htmlFor="e" error="مستخدم قبل كده">
          <input id="e" aria-invalid />
        </Field>
        <FormErrorWatcher />
        <Toaster />
      </>,
    );

    window.dispatchEvent(new Event(FORM_ERRORS_EVENT));
    expect(await screen.findByText(ar.errors.formInvalid)).toBeInTheDocument();
  });

  it("speaks Arabic for zod rules without a message", () => {
    const result = z.object({ age: z.number(), name: z.string().min(3), kind: z.enum(["a", "b"]) }).safeParse({ age: "x", name: "a", kind: "c" });
    const messages = result.success ? [] : result.error.issues.map((i) => i.message);
    expect(messages).toEqual([ar.validation.number, ar.validation.min(3), ar.validation.choose]);
  });
});
