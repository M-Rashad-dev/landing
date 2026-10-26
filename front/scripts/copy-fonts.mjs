// Copies the woff2 files used by public pages from @fontsource into public/fonts.
// Runs before dev/build so tenant pages can load only the fonts they use.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packages = ["cairo", "tajawal", "almarai", "ibm-plex-sans-arabic", "noto-kufi-arabic", "readex-pro"];
const subsets = ["arabic", "latin"];

let copied = 0;
for (const pkg of packages) {
  const source = join(root, "node_modules", "@fontsource", pkg, "files");
  if (!existsSync(source)) {
    console.error(`copy-fonts: missing @fontsource/${pkg}`);
    process.exit(1);
  }
  const target = join(root, "public", "fonts", pkg);
  mkdirSync(target, { recursive: true });
  for (const file of readdirSync(source)) {
    if (!file.endsWith("-normal.woff2")) continue;
    if (!subsets.some((subset) => file.startsWith(`${pkg}-${subset}-`))) continue;
    copyFileSync(join(source, file), join(target, file));
    copied++;
  }
}
console.log(`copy-fonts: ${copied} files`);
