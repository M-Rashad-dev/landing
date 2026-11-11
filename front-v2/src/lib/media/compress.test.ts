import { beforeEach, describe, expect, it, vi } from "vitest";

const compress = vi.fn();
vi.mock("compressly", () => ({ compressImageWithDetails: (...args: unknown[]) => compress(...args) }));

const { prepareImage, ImageRejected, UPLOAD_MAX_BYTES } = await import("./compress");

const file = (type: string, size = 10) => new File([new Uint8Array(size)], "photo", { type });
const result = (f: File) => ({ file: f, originalSize: 0, compressedSize: f.size, reductionPercentage: 0, timeTakenMs: 1, dimensions: { width: 1, height: 1 } });

beforeEach(() => {
  compress.mockReset();
  // jsdom has no canvas: say the browser can write WebP.
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/webp;base64,");
});

describe("prepareImage", () => {
  it("compresses within our limits before upload", async () => {
    const out = file("image/webp");
    compress.mockResolvedValue(result(out));
    await expect(prepareImage(file("image/jpeg", 10_000_000))).resolves.toBe(out);
    expect(compress.mock.calls[0][1]).toMatchObject({ maxWidth: 2000, maxHeight: 2000, targetSizeMB: 1, mimeType: "image/webp" });
  });

  it("refuses what is not an image or still too big", async () => {
    await expect(prepareImage(file("application/pdf"))).rejects.toBeInstanceOf(ImageRejected);
    compress.mockResolvedValue(result(file("image/heic")));
    await expect(prepareImage(file("image/heic"))).rejects.toMatchObject({ reason: "type" });
    compress.mockResolvedValue(result(file("image/jpeg", UPLOAD_MAX_BYTES + 1)));
    await expect(prepareImage(file("image/jpeg"))).rejects.toMatchObject({ reason: "size" });
  });
});
