import { z } from "zod";
import type { TaskStatus, UserRole } from "@/types/database";

export const TASK_STATUSES = ["draft", "active", "archived"] as const satisfies readonly TaskStatus[];

export type TaskInput = {
  title: string;
  description: string;
  requirements: string | null;
  reward_coins: number;
  deadline: string | null;
  evidence_required: boolean;
  status: TaskStatus;
};

export type FieldErrors = Record<string, string>;
type Parsed<T> = { success: true; data: T } | { success: false; fieldErrors: FieldErrors };

/** `<input type="datetime-local">` value, interpreted as UTC. */
const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function datetimeLocalToIso(value: string): string | null {
  if (!DATETIME_LOCAL.test(value)) return null;
  const date = new Date(`${value}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isoToDatetimeLocal(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 16) : "";
}

const taskSchema = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters.").max(120, "Use at most 120 characters."),
  description: z.string().trim().min(1, "Describe the task.").max(5000, "Use at most 5000 characters."),
  requirements: z
    .string()
    .trim()
    .max(2000, "Use at most 2000 characters.")
    .transform((v) => (v === "" ? null : v)),
  reward_coins: z.coerce
    .number({ error: "Enter a whole number." })
    .int("Enter a whole number.")
    .min(1, "The reward must be at least 1 coin.")
    .max(10000, "The reward can be at most 10,000 coins."),
  status: z.enum(TASK_STATUSES, { error: "Choose a status." }),
});

/**
 * Server-side validation of the admin task form.
 *
 * A task can't be made (or kept) open with a deadline in the past: when the
 * result is `active` and the status or the deadline is changing, the deadline
 * must be in the future.
 */
export function parseTaskForm(
  formData: FormData,
  opts: { now: Date; previous?: { status: TaskStatus; deadline: string | null } },
): Parsed<TaskInput> {
  const fieldErrors: FieldErrors = {};
  const parsed = taskSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    requirements: String(formData.get("requirements") ?? ""),
    reward_coins: String(formData.get("reward_coins") ?? "").trim(),
    status: String(formData.get("status") ?? ""),
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
  }

  const rawDeadline = String(formData.get("deadline") ?? "").trim();
  let deadline: string | null = null;
  if (rawDeadline !== "") {
    deadline = datetimeLocalToIso(rawDeadline);
    if (!deadline) fieldErrors.deadline = "Enter a valid date and time.";
  }

  if (parsed.success && !fieldErrors.deadline && parsed.data.status === "active" && deadline) {
    const changing =
      !opts.previous || opts.previous.status !== "active" || opts.previous.deadline !== deadline;
    if (changing && new Date(deadline).getTime() <= opts.now.getTime()) {
      fieldErrors.deadline = "An active task needs a deadline in the future.";
    }
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };
  return {
    success: true,
    data: { ...parsed.data, deadline, evidence_required: formData.get("evidence_required") === "on" },
  };
}

const uuid = z.uuid();

export type ReviewInput = { submissionId: string; decision: "approved" | "rejected"; note: string | null };

/** Rejections need a reason (also enforced by review_submission() in the database). */
export function parseReviewForm(formData: FormData): Parsed<ReviewInput> {
  const fieldErrors: FieldErrors = {};
  const submissionId = String(formData.get("submissionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!uuid.safeParse(submissionId).success) fieldErrors.submissionId = "Invalid submission.";
  if (decision !== "approved" && decision !== "rejected") fieldErrors.decision = "Choose approve or reject.";
  if (note.length > 1000) fieldErrors.note = "Use at most 1000 characters.";
  if (decision === "rejected" && note.length < 3) fieldErrors.note = "Give a reason for the rejection (at least 3 characters).";

  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };
  return {
    success: true,
    data: { submissionId, decision: decision as ReviewInput["decision"], note: note === "" ? null : note },
  };
}

export function parseRoleForm(formData: FormData): Parsed<{ userId: string; role: UserRole }> {
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  const fieldErrors: FieldErrors = {};
  if (!uuid.safeParse(userId).success) fieldErrors.userId = "Invalid user.";
  if (role !== "user" && role !== "admin") fieldErrors.role = "Choose a role.";
  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };
  return { success: true, data: { userId, role: role as UserRole } };
}

export function parseAdjustForm(formData: FormData): Parsed<{ userId: string; amount: number; reason: string }> {
  const fieldErrors: FieldErrors = {};
  const userId = String(formData.get("userId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const amount = Number(amountRaw);

  if (!uuid.safeParse(userId).success) fieldErrors.userId = "Invalid user.";
  if (!/^-?\d+$/.test(amountRaw) || !Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 100000) {
    fieldErrors.amount = "Enter a non-zero whole number between -100,000 and 100,000.";
  }
  if (reason.length < 3 || reason.length > 500) fieldErrors.reason = "Give a reason (3–500 characters).";

  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };
  return { success: true, data: { userId, amount, reason } };
}
