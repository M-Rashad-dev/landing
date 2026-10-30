import { describe, expect, it } from "vitest";
import { APPS_SCRIPT_CODE, SAMPLE_PAYLOAD } from "./apps-script";

describe("Google Sheets Apps Script", () => {
  it("writes one value per header column", () => {
    const headers = APPS_SCRIPT_CODE.match(/var HEADERS = \[([^\]]+)\]/)![1].split(",").filter((h) => h.trim());
    const row = APPS_SCRIPT_CODE.match(/var row = \[\n([\s\S]+?)\n {2}\];/)![1].split("\n").filter((line) => line.trim());
    expect(row).toHaveLength(headers.length);
  });

  it("reads the fields the back-end sends and keeps phones as text", () => {
    for (const field of ["order.number", "order.status_label", "c.phone", "order.total", "order.shipping", "order.items", "body.data"]) expect(APPS_SCRIPT_CODE).toContain(field);
    expect(APPS_SCRIPT_CODE).toContain(`"'" + (c.phone || '')`);
    expect(APPS_SCRIPT_CODE).toContain("LockService");
  });

  it("documents a valid JSON payload apart from the shortened id", () => {
    expect(() => JSON.parse(SAMPLE_PAYLOAD.replace('"4b0d…"', '"x"').replace('"…"', '"x"'))).not.toThrow();
  });
});
