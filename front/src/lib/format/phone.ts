/**
 * Egyptian mobile normalization (mirror of App\Services\PhoneNormalizer).
 * Instant feedback only; the back end is the reference.
 */
const DIGIT_MAP: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

const MOBILE = "1[0125]\\d{8}";
const PATTERNS = [
  new RegExp(`^0(${MOBILE})$`),
  new RegExp(`^\\+20(${MOBILE})$`),
  new RegExp(`^0020(${MOBILE})$`),
  new RegExp(`^20(${MOBILE})$`),
];

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const latin = input.replace(/[٠-٩۰-۹]/g, (d) => DIGIT_MAP[d] ?? d);
  const compact = latin.replace(/[\s\-().‎‏‪-‮]+/g, "");
  for (const pattern of PATTERNS) {
    const match = compact.match(pattern);
    if (match) return `+20${match[1]}`;
  }
  return null;
}

export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null;
}

/** +201012345678 → 01012345678 (local display). */
export function formatPhoneLocal(e164: string | null | undefined): string {
  if (!e164) return "";
  return e164.startsWith("+20") ? `0${e164.slice(3)}` : e164;
}
