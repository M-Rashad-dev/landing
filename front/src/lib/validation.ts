import { z } from "zod";
import { isValidPhone } from "@/lib/format/phone";
import { ar } from "@/messages/ar";

/** Shared zod building blocks with Arabic messages. */
export const zRequiredString = (max = 191, min = 1) =>
  z
    .string({ error: ar.validation.required })
    .trim()
    .min(min, min <= 1 ? ar.validation.required : ar.validation.min(min))
    .max(max, ar.validation.max(max));

export const zEmail = z.string({ error: ar.validation.required }).trim().min(1, ar.validation.required).email(ar.validation.email).max(191, ar.validation.max(191));

export const zPhone = z
  .string({ error: ar.validation.required })
  .trim()
  .min(1, ar.validation.required)
  .refine((value) => isValidPhone(value), ar.validation.phone);

export const zPassword = z.string({ error: ar.validation.required }).min(8, ar.validation.passwordMin).max(255, ar.validation.max(255));
