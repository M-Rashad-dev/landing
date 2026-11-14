"use client";

import { compressImageWithDetails } from "compressly";

/**
 * Every image the dashboard uploads goes through here first (owner decision 2026-11-14,
 * DECISIONS.md): resized and compressed in the browser (Web Worker), WebP when the browser can
 * write it, so a 10 MB phone photo uploads as a few hundred KB instead of being refused.
 * The library (compressly, pinned) stays behind this file only; the back end still checks the
 * real bytes and re-encodes everything.
 */

/** Server ceiling (back: landing.limits.upload_max_kb). */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** What we aim for: sharp on a large screen (the store's biggest variant is 1600 px). */
const TARGET_MB = 1;
const MAX_SIDE = 2000;
const QUALITY = 0.85;

/** Types the back end accepts after compression. */
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/** Inputs we can read and convert (HEIC opens in Safari only; elsewhere it is refused). */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/gif,image/bmp";

export class ImageRejected extends Error {
  constructor(readonly reason: "type" | "size", readonly fileName: string) {
    super(reason);
    this.name = "ImageRejected";
  }
}

let webp: boolean | null = null;

/** Safari before 17 cannot write WebP (toBlob silently returns PNG): JPEG there. */
function canWriteWebp(): boolean {
  if (webp === null) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      webp = canvas.toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
      webp = false;
    }
  }
  return webp;
}

/** One image ready to upload, or ImageRejected (not an image we can read, or still too big). */
export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new ImageRejected("type", file.name);

  const result = await compressImageWithDetails(file, {
    maxWidth: MAX_SIDE,
    maxHeight: MAX_SIDE,
    quality: QUALITY,
    targetSizeMB: TARGET_MB,
    mimeType: canWriteWebp() ? "image/webp" : "image/jpeg",
  });
  const out = result.file;

  if (!ACCEPTED.includes(out.type)) throw new ImageRejected("type", file.name);
  if (out.size > UPLOAD_MAX_BYTES) throw new ImageRejected("size", file.name);
  return out;
}
