import { describe, expect, it } from "vitest";
import { EVIDENCE_MAX_BYTES, checkEvidenceFile, evidencePath, sniffEvidenceType } from "@/lib/tasks/evidence";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const PDF = [...Buffer.from("%PDF-1.7\n")];

const file = (bytes: number[] | Uint8Array, name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });

// Same pattern as the CHECK constraint on task_submissions.evidence_path.
const DB_PATH_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp|pdf)$/;

describe("sniffEvidenceType (content-based detection)", () => {
  it.each([
    [PNG, "image/png", "png"],
    [JPEG, "image/jpeg", "jpg"],
    [WEBP, "image/webp", "webp"],
    [PDF, "application/pdf", "pdf"],
  ])("detects %#", (bytes, mime, ext) => {
    expect(sniffEvidenceType(new Uint8Array(bytes))).toEqual({ mime, ext });
  });

  it.each([
    [[...Buffer.from("<html><script>alert(1)</script>")]],
    [[...Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")]],
    [[0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF: not allowed
    [[0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]], // RIFF but AVI
    [[]],
  ])("rejects unsupported content %#", (bytes) => {
    expect(sniffEvidenceType(new Uint8Array(bytes))).toBeNull();
  });
});

describe("checkEvidenceFile (server-side validation)", () => {
  it("treats 'no file selected' as no evidence", async () => {
    expect(await checkEvidenceFile(null)).toEqual({ ok: true, file: null });
    expect(await checkEvidenceFile(new File([], "", { type: "application/octet-stream" }))).toEqual({
      ok: true,
      file: null,
    });
  });

  it("accepts a real PNG and reports the sniffed type", async () => {
    const result = await checkEvidenceFile(file(PNG, "shot.png", "image/png"));
    expect(result.ok && result.file?.type).toEqual({ mime: "image/png", ext: "png" });
  });

  it("ignores the client's file name and MIME type", async () => {
    // A PDF uploaded as "photo.png" with type image/png is stored as a PDF.
    const result = await checkEvidenceFile(file(PDF, "photo.png", "image/png"));
    expect(result.ok && result.file?.type.ext).toBe("pdf");
  });

  it("rejects an HTML file disguised as an image", async () => {
    const result = await checkEvidenceFile(file([...Buffer.from("<html></html>")], "x.png", "image/png"));
    expect(result).toEqual({ ok: false, error: "Upload a PNG, JPEG, WebP image or a PDF." });
  });

  it("rejects an empty named file", async () => {
    expect(await checkEvidenceFile(file([], "empty.png", "image/png"))).toEqual({ ok: false, error: "That file is empty." });
  });

  it("rejects files over 5 MB", async () => {
    const big = new Uint8Array(EVIDENCE_MAX_BYTES + 1);
    big.set(PNG);
    expect(await checkEvidenceFile(file(big, "big.png", "image/png"))).toEqual({
      ok: false,
      error: "Files can be at most 5 MB.",
    });
  });
});

describe("evidencePath", () => {
  it("puts the file in the user's own folder with a random name the database accepts", () => {
    const userId = crypto.randomUUID();
    const path = evidencePath(userId, "png");
    expect(path.startsWith(`${userId}/`)).toBe(true);
    expect(path).toMatch(DB_PATH_PATTERN);
    expect(evidencePath(userId, "png")).not.toBe(path);
  });
});
