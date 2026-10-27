"use client";

import { useMemo, useState } from "react";
import { THEMES } from "@/themes/registry";
import { SCHEMAS } from "@/themes/shared/schemas";
import { IdentityStyle } from "@/themes/shared/identity-style";
import { COMPONENT_TYPES } from "@/themes/types";
import { DEMO_IDENTITIES, DEMO_PROP_OVERRIDES, demoContext } from "@/themes/dev/fixtures";

const LONG_TEXT = "عنوان طويل جدًا لاختبار التفاف النصوص العربية داخل الكومبوننت بدون كسر التخطيط على الشاشات الصغيرة والكبيرة ";

/** Development tool: pick a theme + identity and scroll through every component × variant. */
export function ThemesReview({ initialTheme, initialIdentity }: { initialTheme: string; initialIdentity: string }) {
  const [themeKey, setThemeKey] = useState(initialTheme in THEMES ? initialTheme : "malak");
  const [identityKey, setIdentityKey] = useState(initialIdentity in DEMO_IDENTITIES ? initialIdentity : "violet");
  const [stress, setStress] = useState(false);
  const theme = THEMES[themeKey];
  // Preview mode: the order form never calls the public API from this tool.
  const ctx = useMemo(() => demoContext(DEMO_IDENTITIES[identityKey]), [identityKey]);

  return (
    <div className="min-h-dvh bg-neutral-200" style={{ fontFamily: "Cairo, sans-serif" }}>
      <div className="sticky top-0 z-[200] flex flex-wrap items-center gap-3 bg-neutral-900 px-4 py-2 text-sm text-white">
        <strong>/dev/themes</strong>
        <select value={themeKey} onChange={(e) => setThemeKey(e.target.value)} className="rounded bg-neutral-700 px-2 py-1">
          {Object.values(THEMES).map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={identityKey} onChange={(e) => setIdentityKey(e.target.value)} className="rounded bg-neutral-700 px-2 py-1">
          {Object.keys(DEMO_IDENTITIES).map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={stress} onChange={(e) => setStress(e.target.checked)} /> long texts
        </label>
      </div>
      <IdentityStyle identity={ctx.identity} className="t-site">
        {COMPONENT_TYPES.flatMap((type) =>
          theme.components[type].variants.map((variant) => {
            const Component = theme.components[type].component;
            const props: Record<string, unknown> = { ...SCHEMAS[type].defaults, ...(DEMO_PROP_OVERRIDES[type] ?? {}) };
            if (stress) {
              for (const key of ["title", "subtitle", "eyebrow", "brand_text"]) if (typeof props[key] === "string") props[key] = LONG_TEXT.repeat(key === "subtitle" ? 4 : 1);
            }
            return (
              <div key={`${type}-${variant.key}`} className="border-b-4 border-dashed border-neutral-400">
                <p className="bg-neutral-800 px-3 py-1 text-xs text-white" dir="ltr">
                  {type} / {variant.key}
                </p>
                <Component sectionId={`${type}-${variant.key}`} props={props} variant={variant.key} ctx={ctx} />
              </div>
            );
          }),
        )}
      </IdentityStyle>
    </div>
  );
}
