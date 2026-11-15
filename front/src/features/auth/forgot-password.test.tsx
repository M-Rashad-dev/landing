import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/messages/ar";
import { ForgotPasswordForm } from "./forgot-password-form";

const f = ar.auth.forgot;
const fetchMock = vi.fn();

function reply(status: number, body?: unknown) {
  fetchMock.mockResolvedValueOnce(body === undefined ? new Response(null, { status }) : Response.json(body, { status }));
}

const bodyOf = (call: number) => JSON.parse(String(fetchMock.mock.calls[call][1].body)) as Record<string, unknown>;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ForgotPasswordForm", () => {
  it("sends a code, then sets the new password", async () => {
    const user = userEvent.setup();
    reply(200, { data: { channel: "whatsapp", expires_in: 300, resend_in: 60, code: null } });
    reply(204);
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(ar.auth.login), "01011112222");
    await user.click(screen.getByRole("button", { name: f.send }));
    expect(await screen.findByText(f.codeSent)).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/password/code");
    expect(bodyOf(0)).toEqual({ login: "01011112222" });
    expect(screen.getByText(f.resendIn(60))).toBeInTheDocument();

    await user.type(screen.getByLabelText(f.code), "482913");
    await user.type(screen.getByLabelText(f.newPassword), "new-password-1");
    await user.type(screen.getByLabelText(f.confirmPassword), "new-password-1");
    await user.click(screen.getByRole("button", { name: f.save }));

    expect(await screen.findByText(f.doneTitle)).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/password/reset");
    expect(bodyOf(1)).toEqual({ login: "01011112222", code: "482913", password: "new-password-1", password_confirmation: "new-password-1" });
    expect(screen.getByRole("link", { name: f.toLogin })).toHaveAttribute("href", "/login");
  });

  it("shows the test code when WhatsApp is not connected, and the server's error on the code", async () => {
    const user = userEvent.setup();
    reply(200, { data: { channel: "screen", expires_in: 300, resend_in: 60, code: "111222" } });
    reply(422, { message: "bad", code: "validation_failed", errors: { code: ["الكود غلط. فاضل 4 محاولات."] } });
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(ar.auth.login), "owner@shop.test");
    await user.click(screen.getByRole("button", { name: f.send }));
    expect(await screen.findByText(`${f.screenCode}: 111222`)).toBeInTheDocument();

    await user.type(screen.getByLabelText(f.code), "999999");
    await user.type(screen.getByLabelText(f.newPassword), "new-password-1");
    await user.type(screen.getByLabelText(f.confirmPassword), "new-password-1");
    await user.click(screen.getByRole("button", { name: f.save }));
    expect(await screen.findByText("الكود غلط. فاضل 4 محاولات.")).toBeInTheDocument();
  });

  it("checks the new password before calling the server", async () => {
    const user = userEvent.setup();
    reply(200, { data: { channel: "whatsapp", expires_in: 300, resend_in: 0, code: null } });
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText(ar.auth.login), "owner@shop.test");
    await user.click(screen.getByRole("button", { name: f.send }));

    await user.type(await screen.findByLabelText(f.code), "12");
    await user.type(screen.getByLabelText(f.newPassword), "new-password-1");
    await user.type(screen.getByLabelText(f.confirmPassword), "other-password");
    await user.click(screen.getByRole("button", { name: f.save }));

    expect(await screen.findByText(f.codeError)).toBeInTheDocument();
    expect(screen.getByText(f.mismatch)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: f.resend })).toBeInTheDocument();
  });
});
