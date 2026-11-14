/**
 * URL slug from a name, Arabic or Latin (mirror of App\Support\Slugs::from, for the live preview;
 * the back end makes it unique and stays the reference): "تيشيرت قطن 100%" → "تيشيرت-قطن-100".
 */
export function slugify(text: string, max = 60): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max)
    .replace(/-$/, "");
  return slug.length >= 2 ? slug : "";
}

export const SLUG_PATTERN = /^[a-z0-9؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+(-[a-z0-9؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+)*$/;
