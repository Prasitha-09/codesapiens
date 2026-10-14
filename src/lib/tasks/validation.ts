import { z } from "zod";

export const PROOF_TEXT_MAX = 5000;
export const PROOF_URL_MAX = 2000;

const uuid = z.uuid("Invalid task.");

const proofText = z
  .string()
  .trim()
  .max(PROOF_TEXT_MAX, `Notes can be at most ${PROOF_TEXT_MAX} characters.`)
  .transform((v) => (v === "" ? null : v));

const proofUrl = z
  .string()
  .trim()
  .max(PROOF_URL_MAX, `Links can be at most ${PROOF_URL_MAX} characters.`)
  .transform((v, ctx) => {
    if (v === "") return null;
    let url: URL;
    try {
      url = new URL(v);
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a full link starting with https://" });
      return z.NEVER;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      ctx.addIssue({ code: "custom", message: "Only http(s) links are allowed." });
      return z.NEVER;
    }
    if (url.username || url.password) {
      ctx.addIssue({ code: "custom", message: "Links can't contain a username or password." });
      return z.NEVER;
    }
    return url.href;
  });

export type SubmissionFields = { taskId: string; proofText: string | null; proofUrl: string | null };
export type SubmissionFieldErrors = Partial<Record<"taskId" | "proofText" | "proofUrl" | "evidence", string>>;

/**
 * Server-side validation of the text fields of a submission. The file is checked
 * separately (see evidence.ts). Only these fields are read — anything else the
 * client sends (user id, reward, deadline, status) is ignored.
 */
export function parseSubmissionFields(
  formData: FormData,
): { success: true; data: SubmissionFields } | { success: false; fieldErrors: SubmissionFieldErrors } {
  const fieldErrors: SubmissionFieldErrors = {};

  const taskId = uuid.safeParse(String(formData.get("taskId") ?? ""));
  if (!taskId.success) fieldErrors.taskId = "Invalid task.";
  const text = proofText.safeParse(String(formData.get("proofText") ?? ""));
  if (!text.success) fieldErrors.proofText = text.error.issues[0].message;
  const url = proofUrl.safeParse(String(formData.get("proofUrl") ?? ""));
  if (!url.success) fieldErrors.proofUrl = url.error.issues[0].message;

  if (!taskId.success || !text.success || !url.success) return { success: false, fieldErrors };
  return { success: true, data: { taskId: taskId.data, proofText: text.data, proofUrl: url.data } };
}
