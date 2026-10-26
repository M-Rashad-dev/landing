import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it("accepts relative paths", () => {
    expect(safeNext("/dashboard/pages?x=1")).toBe("/dashboard/pages?x=1");
  });

  it.each([null, "", "https://evil.com", "//evil.com", "/\\evil.com", "/api/bff/x"])("falls back for %s", (value) => {
    expect(safeNext(value)).toBe("/dashboard");
  });
});
