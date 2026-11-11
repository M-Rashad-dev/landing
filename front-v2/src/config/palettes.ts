/**
 * Color identities under review (tokens in app/globals.css). The chosen one becomes :root
 * and this list is deleted with the picker (HANDOFF.md).
 */
export const PALETTES = ["hibr", "tamr", "nile"] as const;
export type PaletteKey = (typeof PALETTES)[number];

export const PALETTE_STORAGE_KEY = "mk_palette";

/** Runs before paint (inline in <head>) so a chosen palette shows without a flash. */
export const PALETTE_BOOT_SCRIPT = `try{var p=localStorage.getItem("${PALETTE_STORAGE_KEY}");if(p)document.documentElement.dataset.palette=p}catch(e){}`;
