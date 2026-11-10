import { describe, expect, it } from "vitest";
import { APP_ALLOWED_PREFIXES, APP_ONLY_PREFIXES, classifyHost, LEGAL_PATHS, matchesPrefix, normalizeHost } from "./classify";

const config = { platformDomain: "platform.com", appHost: "app.platform.com" };

describe("normalizeHost", () => {
  it("lowercases and strips port and trailing dot", () => {
    expect(normalizeHost("Store-1.Platform.com:443")).toBe("store-1.platform.com");
    expect(normalizeHost("mystore.com.")).toBe("mystore.com");
    expect(normalizeHost("[::1]:3000")).toBe("[::1]");
    expect(normalizeHost(null)).toBe("");
  });
});

describe("classifyHost", () => {
  it("detects the app host", () => {
    expect(classifyHost("app.platform.com", config)).toBe("app");
    expect(classifyHost("APP.platform.com:3000", config)).toBe("app");
  });

  it("detects the platform host", () => {
    expect(classifyHost("platform.com", config)).toBe("platform");
    expect(classifyHost("www.platform.com", config)).toBe("platform");
  });

  it("treats everything else as a tenant host", () => {
    expect(classifyHost("store-4821.platform.com", config)).toBe("tenant");
    expect(classifyHost("mystore.com", config)).toBe("tenant");
  });
});

describe("matchesPrefix", () => {
  it("matches exact segments only", () => {
    expect(matchesPrefix("/dashboard", APP_ONLY_PREFIXES)).toBe(true);
    expect(matchesPrefix("/dashboard/pages", APP_ONLY_PREFIXES)).toBe(true);
    expect(matchesPrefix("/dashboards", APP_ONLY_PREFIXES)).toBe(false);
    expect(matchesPrefix("/offer", APP_ONLY_PREFIXES)).toBe(false);
  });
});

describe("legal pages", () => {
  it("are allowed on the app host and never app-only (store hosts render their own pages)", () => {
    for (const path of LEGAL_PATHS) {
      expect(matchesPrefix(path, APP_ALLOWED_PREFIXES)).toBe(true);
      expect(matchesPrefix(path, APP_ONLY_PREFIXES)).toBe(false);
    }
  });
});
