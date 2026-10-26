"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return <Sonner dir="rtl" position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "inherit" } }} />;
}

export { toast } from "sonner";
