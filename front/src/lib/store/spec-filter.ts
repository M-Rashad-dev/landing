/**
 * Spec filters in a store list's link (docs/plans/tekno/PLAN.md §2.1): `?spec[الرامات]=16GB&spec[الرامات]=8GB`
 * (several values of a label = any of them, several labels = all). Inside the app the choice travels as one
 * canonical JSON string (labels and values sorted), which is also what the server reads.
 */

export type SpecChoice = Record<string, string[]>;

const MAX_LABELS = 10;
const MAX_VALUES = 20;
const KEY = /^spec\[([\s\S]+)\]$/;

/** The canonical JSON of a choice (undefined when empty). */
export function encodeSpec(choice: SpecChoice): string | undefined {
  const labels = Object.keys(choice)
    .map((l) => l.trim().slice(0, 60))
    .filter(Boolean)
    .sort()
    .slice(0, MAX_LABELS);
  const out: SpecChoice = {};
  for (const label of labels) {
    const values = [...new Set((choice[label] ?? []).map((v) => v.trim().slice(0, 200)).filter(Boolean))].sort().slice(0, MAX_VALUES);
    if (values.length) out[label] = values;
  }
  return Object.keys(out).length ? JSON.stringify(out) : undefined;
}

export function decodeSpec(json: string | undefined): SpecChoice {
  if (!json) return {};
  try {
    const data = JSON.parse(json) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const out: SpecChoice = {};
    for (const [label, values] of Object.entries(data as Record<string, unknown>)) {
      if (Array.isArray(values)) out[label] = values.filter((v): v is string => typeof v === "string");
    }
    return out;
  } catch {
    return {};
  }
}

/** The choice from a page's search params (`spec[label]` keys). */
export function specFromSearch(search: Record<string, string | string[] | undefined>): string | undefined {
  const choice: SpecChoice = {};
  for (const [key, raw] of Object.entries(search)) {
    const match = KEY.exec(key);
    if (!match || raw === undefined) continue;
    const label = match[1].trim();
    choice[label] = [...(choice[label] ?? []), ...(Array.isArray(raw) ? raw : [raw])];
  }
  return encodeSpec(choice);
}

/** The link params of a choice, in order. */
export function specParams(json: string | undefined): Array<[string, string]> {
  return Object.entries(decodeSpec(json)).flatMap(([label, values]) => values.map((v) => [`spec[${label}]`, v] as [string, string]));
}

/** The choice with one value turned on or off. */
export function toggleSpecValue(json: string | undefined, label: string, value: string, on: boolean): string | undefined {
  const choice = decodeSpec(json);
  const values = new Set(choice[label] ?? []);
  if (on) values.add(value);
  else values.delete(value);
  return encodeSpec({ ...choice, [label]: [...values] });
}
