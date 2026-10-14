import "server-only";
import QRCode, { type QRCodeToBufferOptions, type QRCodeToStringOptions } from "qrcode";

// High-contrast ink-on-white with a quiet zone, so phone cameras scan it reliably.
const base = {
  errorCorrectionLevel: "M",
  margin: 2,
  color: { dark: "#0b0b0bff", light: "#ffffffff" },
} as const;

export const QR_PNG_WIDTH = 1024;

/** QR code as an SVG document string. */
export function qrSvg(text: string): Promise<string> {
  const options: QRCodeToStringOptions = { ...base, type: "svg" };
  return QRCode.toString(text, options);
}

/** QR code as a PNG image (square, `width` pixels). */
export function qrPng(text: string, width: number = QR_PNG_WIDTH): Promise<Buffer> {
  const options: QRCodeToBufferOptions = { ...base, type: "png", width };
  return QRCode.toBuffer(text, options);
}

/** SVG as a data: URI, for an <img> preview without injecting markup into the page. */
export async function qrSvgDataUri(text: string): Promise<string> {
  const svg = await qrSvg(text);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
