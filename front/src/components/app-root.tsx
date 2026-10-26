import "@fontsource/cairo/400.css";
import "@fontsource/cairo/500.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/cairo/800.css";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";

/** Wrapper for platform-side screens (marketing, auth, dashboard, admin, preview chrome). */
export function AppRoot({ children }: { children: ReactNode }) {
  return (
    <Providers>
      {children}
      <Toaster />
    </Providers>
  );
}
