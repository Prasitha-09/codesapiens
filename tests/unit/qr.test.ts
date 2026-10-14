import jsQR from "jsqr";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { isValidPublicSlug, publicProfileUrl } from "@/lib/profile/public-url";
import { QR_PNG_WIDTH, qrPng, qrSvg, qrSvgDataUri } from "@/lib/profile/qr";

const SITE = "https://taskmint.example";
const SLUG = "0123456789ab";

describe("public profile URL", () => {
  it("builds an absolute /u/<slug> URL from the site URL", () => {
    expect(publicProfileUrl(SLUG, SITE)).toBe("https://taskmint.example/u/0123456789ab");
    expect(publicProfileUrl(SLUG, "http://localhost:3000")).toBe("http://localhost:3000/u/0123456789ab");
  });

  it.each(["", "0123456789AB", "0123456789a", "0123456789abc", "../../admin", "0123456789a/", null, 123])(
    "rejects malformed slug %j",
    (slug) => {
      expect(isValidPublicSlug(slug)).toBe(false);
      expect(() => publicProfileUrl(slug as string, SITE)).toThrow();
    },
  );
});

describe("QR code generation", () => {
  const url = publicProfileUrl(SLUG, SITE);

  it("produces a PNG that scans back to exactly the public profile URL", async () => {
    const buffer = await qrPng(url);
    // PNG signature
    expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");

    const png = PNG.sync.read(buffer);
    expect(png.width).toBe(QR_PNG_WIDTH);
    expect(png.height).toBe(QR_PNG_WIDTH);

    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe(url);
  });

  it("produces an SVG document", async () => {
    const svg = await qrSvg(url);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).not.toMatch(/<script/i);
  });

  it("produces a base64 SVG data URI for the inline preview", async () => {
    const uri = await qrSvgDataUri(url);
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const svg = Buffer.from(uri.split(",")[1], "base64").toString("utf8");
    expect(svg).toBe(await qrSvg(url));
  });
});
