import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ar } from "@/messages/ar";
import { RefundNotes } from "./refund-notes";

const t = ar.refunds.public;
afterEach(() => cleanup());

describe("refunds on the tracking and order pages", () => {
  it("shows what went back and what is on its way", () => {
    render(
      <RefundNotes
        refunds={[
          { amount: 120, status: "done", method: "محفظة", done_at: "2026-11-25T10:00:00Z" },
          { amount: 30, status: "pending", method: "كاش", done_at: null },
        ]}
      />,
    );
    expect(screen.getByText(t.title)).toBeInTheDocument();
    expect(screen.getByText(t.done("120 ج.م", "محفظة"))).toBeInTheDocument();
    expect(screen.getByText(t.pending("30 ج.م"))).toBeInTheDocument();
  });

  it("says nothing without refunds", () => {
    const { container } = render(<RefundNotes refunds={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
