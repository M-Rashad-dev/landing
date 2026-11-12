import { describe, expect, it } from "vitest";
import { APP_ALLOWED_PREFIXES, APP_ONLY_PREFIXES, classifyHost, matchesPrefix } from "./classify";

const config = { platformDomain: "platform.com", appHost: "app.platform.com" };

describe("classifyHost", () => {
  it("detects the app host, any port or case", () => {
    expect(classifyHost("app.platform.com", config)).toBe("app");
    expect(classifyHost("APP.platform.com:3000", config)).toBe("app");
  });

  it("detects the platform host", () => {
    expect(classifyHost("platform.com", config)).toBe("platform");
    expect(classifyHost("www.platform.com", config)).toBe("platform");
  });

  it("treats everything else as a store host", () => {
    expect(classifyHost("store-4821.platform.com", config)).toBe("tenant");
    expect(classifyHost("mystore.com.", config)).toBe("tenant");
  });
});

describe("matchesPrefix", () => {
  it("matches whole segments only", () => {
    expect(matchesPrefix("/dashboard", APP_ONLY_PREFIXES)).toBe(true);
    expect(matchesPrefix("/dashboard/design/builder", APP_ONLY_PREFIXES)).toBe(true);
    expect(matchesPrefix("/dashboards", APP_ONLY_PREFIXES)).toBe(false);
    expect(matchesPrefix("/products", APP_ONLY_PREFIXES)).toBe(false);
  });

  it("keeps store pages off the app host", () => {
    expect(matchesPrefix("/products", APP_ALLOWED_PREFIXES)).toBe(false);
    expect(matchesPrefix("/sites/x.com", APP_ALLOWED_PREFIXES)).toBe(false);
    expect(matchesPrefix("/media/1/a.webp", APP_ALLOWED_PREFIXES)).toBe(true);
  });
});
