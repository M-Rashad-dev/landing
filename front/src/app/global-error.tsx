"use client";

import { siteMessages } from "@/messages/site";

/** Last resort when the root layout itself fails: renders its own html/body, Arabic and RTL. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fff", color: "#0f172a" }}>
        <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>{siteMessages.errorTitle}</h1>
          <p style={{ color: "#64748b", maxWidth: 420, margin: 0 }}>{siteMessages.errorText}</p>
          <button type="button" onClick={reset} style={{ marginTop: 8, padding: "10px 20px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 600, cursor: "pointer" }}>
            {siteMessages.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
