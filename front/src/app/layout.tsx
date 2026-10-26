import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ar } from "@/messages/ar";

export const metadata: Metadata = {
  title: { default: ar.app.name, template: `%s | ${ar.app.name}` },
  description: ar.app.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Minimal root: fonts, providers and toasts are added by the app-side layouts
 * so public tenant pages only ship what their theme needs.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
