/**
 * The platform name lives here only. «مكسب» is temporary (owner decision 2026-11-11):
 * renaming the platform = editing this file (+ the logo files in public/brand, drawn by components/brand/logo.tsx).
 */
export const BRAND = {
  name: "مكسب",
  latinName: "Maksab",
  tagline: "منصة متاجرك الإلكترونية",
} as const;

/** The platform's tab and home-screen icons (its own pages only: merchant stores show their own). */
export const BRAND_ICONS = { icon: [{ url: "/brand/icon.png", type: "image/png" }], apple: [{ url: "/brand/apple-icon.png" }] };
