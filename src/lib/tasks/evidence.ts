/**
 * Evidence file rules. Kept in sync with the `submission-evidence` bucket
 * settings in supabase/migrations/20261014000004_task_evidence.sql.
 */

export const EVIDENCE_BUCKET = "submission-evidence";
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

export type EvidenceType = { mime: "image/png" | "image/jpeg" | "image/webp" | "application/pdf"; ext: string };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

/**
 * Identify a file by its content ("magic bytes"), ignoring the name and the
 * browser-supplied MIME type, which the client fully controls.
 */
export function sniffEvidenceType(bytes: Uint8Array): EvidenceType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: "pdf" };
  return null;
}

export type EvidenceCheck =
  | { ok: true; file: null }
  | { ok: true; file: { bytes: Uint8Array; type: EvidenceType } }
  | { ok: false; error: string };

/** Server-side validation of an optional uploaded file. */
export async function checkEvidenceFile(value: FormDataEntryValue | null): Promise<EvidenceCheck> {
  // Browsers send an empty, nameless file when nothing was selected.
  if (value === null || typeof value === "string" || (value.size === 0 && value.name === "")) {
    return { ok: true, file: null };
  }
  if (value.size === 0) return { ok: false, error: "That file is empty." };
  if (value.size > EVIDENCE_MAX_BYTES) return { ok: false, error: "Files can be at most 5 MB." };

  const bytes = new Uint8Array(await value.arrayBuffer());
  const type = sniffEvidenceType(bytes);
  if (!type) return { ok: false, error: "Upload a PNG, JPEG, WebP image or a PDF." };
  return { ok: true, file: { bytes, type } };
}

/** `<user_id>/<random uuid>.<ext>` — matches the DB CHECK and storage policies. */
export function evidencePath(userId: string, ext: string, id: string = crypto.randomUUID()) {
  return `${userId}/${id}.${ext}`;
}
