import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "@fontsource/readex-pro/500.css";
import "@fontsource/readex-pro/600.css";
import "@fontsource/readex-pro/700.css";
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
