import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/messages/ar";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";

const router = { replace: vi.fn(), refresh: vi.fn() };
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search),
}));

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function sentBody(): Record<string, unknown> {
  return JSON.parse(String(fetchMock.mock.calls[0][1].body));
}

beforeEach(() => {
  search = "";
  router.replace.mockReset();
  router.refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function fillLogin(login = "demo@example.com", password = "demo-pass-123") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(ar.auth.login), login);
  await user.type(screen.getByLabelText(ar.auth.password), password);
  await user.click(screen.getByRole("button", { name: ar.auth.submitLogin }));
}

describe("LoginForm", () => {
  it("checks the fields before calling the server", async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: ar.auth.submitLogin }));
    expect(await screen.findAllByText(ar.validation.required)).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a store owner to the dashboard", async () => {
    reply(200, { data: { user: { role: "owner" } } });
    render(<LoginForm />);
    await fillLogin();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/login");
    expect(sentBody()).toEqual({ login: "demo@example.com", password: "demo-pass-123" });
  });

  it("sends the platform admin to /admin from the same page", async () => {
    reply(200, { data: { user: { role: "super_admin" } } });
    render(<LoginForm />);
    await fillLogin("admin@example.com");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin"));
  });

  it("returns to the page that asked for sign in, never to another site", async () => {
    search = "next=/dashboard/orders";
    reply(200, { data: { user: { role: "owner" } } });
    const { unmount } = render(<LoginForm />);
    await fillLogin();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/orders"));
    unmount();

    search = "next=//evil.example";
    reply(200, { data: { user: { role: "owner" } } });
    render(<LoginForm />);
    await fillLogin();
    await waitFor(() => expect(router.replace).toHaveBeenLastCalledWith("/dashboard"));
  });

  it("shows one message for wrong credentials", async () => {
    reply(422, { message: "بيانات الدخول غير صحيحة", code: "invalid_credentials", errors: { login: ["بيانات الدخول غير صحيحة"] } });
    render(<LoginForm />);
    await fillLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent("بيانات الدخول غير صحيحة");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows a network message when the server is unreachable", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    render(<LoginForm />);
    await fillLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent(ar.errors.network);
  });
});

describe("RegisterForm", () => {
  async function fillRegister() {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(ar.auth.name), "منى علي");
    await user.type(screen.getByLabelText(ar.auth.storeName), "بيت القهوة");
    await user.type(screen.getByLabelText(ar.auth.email), "mona@example.com");
    await user.type(screen.getByLabelText(ar.auth.phone), "010 1234 5678");
    await user.type(screen.getByLabelText(ar.auth.password), "secret-pass-1");
    await user.click(screen.getByRole("button", { name: ar.auth.submitRegister }));
  }

  it("sends a normalized phone and the password confirmation the back end expects", async () => {
    reply(201, { data: { user: { role: "owner" } } });
    render(<RegisterForm />);
    await fillRegister();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
    expect(sentBody()).toEqual({
      name: "منى علي",
      store_name: "بيت القهوة",
      email: "mona@example.com",
      phone: "+201012345678",
      password: "secret-pass-1",
      password_confirmation: "secret-pass-1",
    });
  });

  it("puts server validation errors under their fields", async () => {
    reply(422, { message: "invalid", code: "validation_failed", errors: { email: ["البريد مستخدم قبل كده"] } });
    render(<RegisterForm />);
    await fillRegister();
    expect(await screen.findByText("البريد مستخدم قبل كده")).toBeInTheDocument();
    expect(screen.getByLabelText(ar.auth.email)).toHaveAttribute("aria-invalid", "true");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("rejects a short password and a non Egyptian phone on the spot", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText(ar.auth.phone), "12345");
    await user.type(screen.getByLabelText(ar.auth.password), "short");
    await user.click(screen.getByRole("button", { name: ar.auth.submitRegister }));
    expect(await screen.findByText(ar.validation.phone)).toBeInTheDocument();
    expect(screen.getByText(ar.validation.passwordMin)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("PasswordInput", () => {
  it("shows and hides the password", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const input = screen.getByLabelText(ar.auth.password);
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: ar.common.showPassword }));
    expect(input).toHaveAttribute("type", "text");
  });
});

describe("RegisterForm empty submit", () => {
  it("says the field is required (not too short) when it is empty", async () => {
    render(<RegisterForm />);
    fireEvent.click(screen.getByRole("button", { name: ar.auth.submitRegister }));
    expect(await screen.findAllByText(ar.validation.required)).toHaveLength(4);
    expect(screen.getByText(ar.validation.passwordMin)).toBeInTheDocument();
  });
});
