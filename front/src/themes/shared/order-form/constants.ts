/** Order form constants needed at runtime on public pages (the schema module also carries Builder labels). */
export const BUILT_IN_FIELDS = ["name", "phone", "phone2", "governorate", "city", "address", "notes"] as const;
export type BuiltInField = (typeof BUILT_IN_FIELDS)[number];

export const LOCKED_FIELDS: readonly BuiltInField[] = ["name", "phone"];
