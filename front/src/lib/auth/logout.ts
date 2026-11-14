"use client";

/** Ends the session (Laravel token + our cookie), then a full reload to the sign in page (drops every cached screen of the old session). */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } finally {
    // Even if the network fails: the cookie is httpOnly, the login page is the only way forward.
    window.location.assign(new URL("/login", window.location.origin).toString());
  }
}
