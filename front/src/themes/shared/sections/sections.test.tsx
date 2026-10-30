import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { demoContext } from "@/themes/dev/fixtures";
import { SCHEMAS } from "@/themes/shared/schemas";
import { SiteRenderer } from "@/themes/site-renderer";
import type { Section } from "@/themes/types";
import { embedUrl, parseVideoUrl, posterUrl } from "./video-url";

afterEach(cleanup);

describe("video links", () => {
  it.each([
    ["https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=10", "aqz-KE-bpKQ"],
    ["https://youtu.be/aqz-KE-bpKQ?si=x", "aqz-KE-bpKQ"],
    ["https://m.youtube.com/shorts/aqz-KE-bpKQ", "aqz-KE-bpKQ"],
    ["https://www.youtube.com/embed/aqz-KE-bpKQ", "aqz-KE-bpKQ"],
  ])("reads YouTube %s", (url, id) => {
    expect(parseVideoUrl(url)).toEqual({ kind: "youtube", id });
  });

  it("reads Vimeo and direct files, and embeds through privacy hosts", () => {
    expect(parseVideoUrl("https://vimeo.com/76979871")).toEqual({ kind: "vimeo", id: "76979871" });
    expect(parseVideoUrl("https://cdn.example.com/clip.MP4")).toEqual({ kind: "file", url: "https://cdn.example.com/clip.MP4" });
    expect(embedUrl({ kind: "youtube", id: "aqz-KE-bpKQ" })).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/aqz-KE-bpKQ\?/);
    expect(embedUrl({ kind: "vimeo", id: "76979871" })).toMatch(/^https:\/\/player\.vimeo\.com\/video\/76979871/);
    expect(posterUrl({ kind: "youtube", id: "aqz-KE-bpKQ" })).toBe("https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg");
  });

  it.each(["", "javascript:alert(1)", "http://youtu.be/aqz-KE-bpKQ", "https://youtube.com/watch?v=short", "https://example.com/page", "not a url"])("ignores %s", (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });
});

const section = (type: Section["type"], props: Record<string, unknown> = {}, variant = ""): Section => ({ id: "11111111-2222-4333-8444-555555555555", type, variant, visible: true, props: { ...SCHEMAS[type].defaults, ...props } });

describe("conversion sections", () => {
  it("loads the video player only after the play click", () => {
    const { container } = render(<SiteRenderer themeKey="malak" sections={[section("video", { video_url: "https://youtu.be/aqz-KE-bpKQ" })]} ctx={demoContext()} />);
    expect(container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "تشغيل الفيديو" }));
    expect(container.querySelector("iframe")?.getAttribute("src")).toContain("youtube-nocookie.com/embed/aqz-KE-bpKQ");
  });

  it("hides sections that have nothing to show", () => {
    const { container } = render(
      <SiteRenderer
        themeKey="celia"
        sections={[section("video", { video_url: "https://example.com" }), section("before_after", { before_media_id: null }), section("size_chart", { rows: [] }), section("countdown", { mode: "fixed", ends_at: "" })]}
        ctx={demoContext()}
      />,
    );
    expect(container.querySelectorAll("section")).toHaveLength(0);
  });

  it("keeps the sticky order button outside the scroll-reveal box and links it to the form", () => {
    const { container } = render(<SiteRenderer themeKey="malak" sections={[section("sticky_cta")]} ctx={{ ...demoContext(), isPreview: true }} />);
    const wrapper = container.querySelector('[data-section-type="sticky_cta"]');
    expect(wrapper?.hasAttribute("data-reveal")).toBe(false);
    expect(wrapper?.className).toBe("contents");
    expect(screen.getByRole("link", { name: /اطلب الآن/ }).getAttribute("href")).toBe("#order");
  });

  it("drops empty size columns and marks comparison cells for screen readers", () => {
    render(
      <SiteRenderer
        themeKey="malak"
        sections={[section("size_chart", { col3_label: "", rows: [{ size: "L", col1: "100", col2: "72", col3: "" }] }), section("comparison", { rows: [{ feature: "ضمان", us: true, them: false }] })]}
        ctx={demoContext()}
      />,
    );
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["المقاس", "الصدر", "الطول", "ليه إحنا؟", "منتجنا", "المنتجات التانية"]);
    expect(screen.getByText("متوفر")).toBeTruthy();
    expect(screen.getByText("غير متوفر")).toBeTruthy();
  });
});
