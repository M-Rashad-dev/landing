import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/overlay";
import { ar } from "@/messages/ar";
import { MailPage, type MailSettings } from "./mail-page";

const t = ar.mail;
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const base: MailSettings = {
  mode: "platform",
  sender_name: null,
  reply_to: null,
  default_sender_name: "متجر حبة",
  default_reply_to: "owner@habba.store",
  platform_address: "noreply@mksab.store",
  smtp: { host: null, port: null, encryption: null, username: null, from_address: null, has_password: false },
  status: null,
  last_error: null,
  checked_at: null,
};

function wrap() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <MailPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

/** A label as a pattern (the required / optional marks follow it). */
const label = (text: string) => new RegExp(text.replace(/[()]/g, "\\$&"));
const body = (call: number) => JSON.parse(String((fetchMock.mock.calls[call]?.[1] as RequestInit).body));

describe("MailPage", () => {
  it("starts on the platform mail and says where emails come from and where replies go", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: base }));
    wrap();

    expect(await screen.findByText(t.modes.platform.description("noreply@mksab.store"))).toBeInTheDocument();
    expect(screen.getByText(t.senderNameHint("متجر حبة"))).toBeInTheDocument();
    expect(screen.getByText(t.replyToHint("owner@habba.store"))).toBeInTheDocument();
    expect(screen.queryByLabelText(label(t.password))).not.toBeInTheDocument();
  });

  it("asks for the Gmail address and app password, with Gmail's settings filled in", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: base }));
    wrap();
    fireEvent.click(await screen.findByRole("radio", { name: new RegExp(t.modes.smtp.title) }));

    expect(screen.getByText(t.gmailHelp)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));
    expect(await screen.findByText(t.passwordRequired)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(Response.json({ data: { ...base, mode: "smtp", status: "active", smtp: { host: "smtp.gmail.com", port: 465, encryption: "ssl", username: "store@gmail.com", from_address: null, has_password: true } } }));
    fireEvent.change(screen.getByLabelText(label(t.username)), { target: { value: "store@gmail.com" } });
    fireEvent.change(screen.getByLabelText(label(t.password)), { target: { value: "abcd efgh ijkl mnop" } });
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(body(1)).toEqual({
      mode: "smtp",
      sender_name: null,
      reply_to: null,
      smtp_host: "smtp.gmail.com",
      smtp_port: 465,
      smtp_encryption: "ssl",
      smtp_username: "store@gmail.com",
      smtp_password: "abcd efgh ijkl mnop",
      from_address: null,
    });
    expect(await screen.findByText(t.status.active)).toBeInTheDocument();
    expect(screen.getByText(t.passwordSaved)).toBeInTheDocument();
  });

  it("shows the login error under the password", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: base }));
    wrap();
    fireEvent.click(await screen.findByRole("radio", { name: new RegExp(t.modes.smtp.title) }));
    fetchMock.mockResolvedValueOnce(Response.json({ message: "x", code: "validation_failed", errors: { smtp_password: ["الإيميل أو كلمة سر التطبيق مش صحيحة."] } }, { status: 422 }));
    fireEvent.change(screen.getByLabelText(label(t.username)), { target: { value: "store@gmail.com" } });
    fireEvent.change(screen.getByLabelText(label(t.password)), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: ar.common.save }));

    expect(await screen.findByText("الإيميل أو كلمة سر التطبيق مش صحيحة.", { selector: "[data-field-error]" })).toBeInTheDocument();
  });

  it("warns when the store's mailbox stopped, and sends a test email", async () => {
    const failed = { ...base, mode: "smtp" as const, status: "failed" as const, last_error: "مقدرناش نوصل لسيرفر الإيميل.", smtp: { host: "smtp.zoho.com", port: 465, encryption: "ssl" as const, username: "a@b.com", from_address: null, has_password: true } };
    fetchMock.mockResolvedValueOnce(Response.json({ data: failed }));
    wrap();

    expect(await screen.findByText(t.failedTitle)).toBeInTheDocument();
    expect(screen.getByText(t.failedText("مقدرناش نوصل لسيرفر الإيميل."))).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(Response.json({ data: { via: "smtp", to: "me@b.com", settings: { ...failed, status: "active", last_error: null } } }));
    fireEvent.change(screen.getByLabelText(t.testTo), { target: { value: "me@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: t.testSend }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/dashboard/mail-settings/test");
    expect(body(1)).toEqual({ to: "me@b.com" });
    expect(await screen.findByText(t.status.active)).toBeInTheDocument();
  });
});
