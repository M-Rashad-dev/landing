import { afterEach, describe, expect, it, vi } from "vitest";
import { matchRoute, pickVariant, routesForHost, slugOfPath, type AbRoute } from "./split";

const route: AbRoute = { id: 7, entries: ["offer-a", ""], a: "offer-a", b: "offer-b", split_a: 70 };

describe("A/B split", () => {
  it("reads page slugs from paths and skips non-pages", () => {
    expect(slugOfPath("/")).toBe("");
    expect(slugOfPath("/Offer-A/")).toBe("offer-a");
    expect(slugOfPath(`/${encodeURIComponent("عرض")}`)).toBe("عرض");
    expect(slugOfPath("/track")).toBeNull();
    expect(slugOfPath("/robots.txt")).toBeNull();
    expect(slugOfPath("/a/b")).toBeNull();
  });

  it("matches the entry link (and the home page when A is home)", () => {
    expect(matchRoute([route], "/offer-a")?.id).toBe(7);
    expect(matchRoute([route], "/")?.id).toBe(7);
    expect(matchRoute([route], "/offer-b")).toBeNull();
    expect(matchRoute([{ ...route, entries: ["offer-a"] }], "/")).toBeNull();
  });

  it("splits by split_a, keeps the saved variant, and sends everyone to a B winner", () => {
    expect(pickVariant(route, undefined, 0.69)).toBe("a");
    expect(pickVariant(route, undefined, 0.7)).toBe("b");
    expect(pickVariant(route, "b", 0.1)).toBe("b");
    expect(pickVariant(route, "x", 0.1)).toBe("a");
    expect(pickVariant({ ...route, split_a: 0 }, "a", 0.1)).toBe("b");
    const share = Array.from({ length: 1000 }, (_, i) => pickVariant(route, undefined, i / 1000)).filter((v) => v === "a").length;
    expect(share).toBe(700);
  });
});

describe("routes cache", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("caches per host for 30 seconds and falls back to no tests on errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [route] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await routesForHost("cache.localhost", 1_000)).toEqual([route]);
    expect(await routesForHost("cache.localhost", 20_000)).toEqual([route]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/public/ab-routes?host=cache.localhost");

    fetchMock.mockRejectedValueOnce(new Error("down"));
    expect(await routesForHost("cache.localhost", 40_000)).toEqual([]);
    expect(await routesForHost("cache.localhost", 45_000)).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
