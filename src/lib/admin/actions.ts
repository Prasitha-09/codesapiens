"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminOrNull } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { TaskStatus } from "@/types/database";
import {
  TASK_STATUSES,
  parseAdjustForm,
  parseReviewForm,
  parseRoleForm,
  parseTaskForm,
  type FieldErrors,
} from "./validation";

/**
 * Admin Server Actions. Each one:
 *   1. re-verifies the caller is an admin (from the database) — never trusts the page,
 *   2. validates input on the server,
 *   3. writes with the admin's own session, so RLS / SECURITY DEFINER functions
 *      enforce the same rules again and record the audit trail.
 */

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string; at: number }
  | { status: "error"; message?: string; fieldErrors?: FieldErrors };

const forbidden: ActionState = { status: "error", message: "You don't have permission to do that." };
const ok = (message: string): ActionState => ({ status: "success", message, at: Date.now() });
const fail = (message: string, fieldErrors?: FieldErrors): ActionState => ({ status: "error", message, fieldErrors });

function dbError(error: { code?: string; message?: string }, context: string): ActionState {
  switch (error.code) {
    case "42501":
      // Covers "not an admin", "own submission", "own role" and "own balance".
      return fail(error.message?.includes("own") ? error.message : "You don't have permission to do that.");
    case "55000":
      return fail("This submission has already been reviewed (possibly by another admin). The list has been refreshed.");
    case "P0002":
      return fail("That record no longer exists.");
    case "22023":
    case "22001":
      return fail(error.message ?? "Invalid input.");
    case "23514":
      return fail(error.message?.includes("negative") ? "That would make the balance negative." : "A value was out of range.");
    default:
      console.error(`admin action failed: ${context}`, error.code);
      return fail("Something went wrong. Please try again.");
  }
}

// ---------------------------------------------------------------- tasks

export async function createTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getAdminOrNull())) return forbidden;
  const parsed = parseTaskForm(formData, { now: new Date() });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.fieldErrors);

  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").insert(parsed.data).select("id").single();
  if (error) return dbError(error, "createTask");

  revalidatePath("/admin", "layout");
  revalidatePath("/tasks");
  redirect(`/admin/tasks/${data.id}?created=1`);
}

export async function updateTask(taskId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getAdminOrNull())) return forbidden;
  const supabase = await createClient();
  const { data: previous, error: readError } = await supabase
    .from("tasks")
    .select("status, deadline")
    .eq("id", taskId)
    .maybeSingle();
  if (readError) return dbError(readError, "updateTask/read");
  if (!previous) return fail("That task no longer exists.");

  const parsed = parseTaskForm(formData, { now: new Date(), previous });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.fieldErrors);

  const { data, error } = await supabase.from("tasks").update(parsed.data).eq("id", taskId).select("id").maybeSingle();
  if (error) return dbError(error, "updateTask");
  if (!data) return forbidden; // RLS filtered the row out

  revalidatePath("/admin", "layout");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return ok("Task saved.");
}

export async function setTaskStatus(taskId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getAdminOrNull())) return forbidden;
  const status = String(formData.get("status") ?? "") as TaskStatus;
  if (!TASK_STATUSES.includes(status)) return fail("Invalid status.");

  const supabase = await createClient();
  const { data: task, error: readError } = await supabase
    .from("tasks")
    .select("status, deadline")
    .eq("id", taskId)
    .maybeSingle();
  if (readError) return dbError(readError, "setTaskStatus/read");
  if (!task) return fail("That task no longer exists.");
  if (status === "active" && task.deadline && new Date(task.deadline).getTime() <= Date.now()) {
    return fail("Set a future deadline before publishing this task.");
  }

  const { data, error } = await supabase.from("tasks").update({ status }).eq("id", taskId).select("id").maybeSingle();
  if (error) return dbError(error, "setTaskStatus");
  if (!data) return forbidden;

  revalidatePath("/admin", "layout");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  const label = { draft: "moved to draft", active: "published", archived: "archived" }[status];
  return ok(`Task ${label}.`);
}

// ---------------------------------------------------------- submissions

export async function reviewSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getAdminOrNull())) return forbidden;
  const parsed = parseReviewForm(formData);
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.fieldErrors);

  const { submissionId, decision, note } = parsed.data;
  const supabase = await createClient();
  // Locking, self-review protection, idempotency, reward payout and the audit
  // record all happen atomically inside review_submission().
  const { error } = await supabase.rpc("review_submission", {
    p_submission_id: submissionId,
    p_decision: decision,
    p_note: note,
  });

  // Other errors (validation, own submission, permission) leave the item in the
  // queue, so show them in place.
  if (error && error.code !== "55000") return dbError(error, "reviewSubmission");

  // Success, or someone else already reviewed it: the item leaves the pending
  // queue, so report the outcome on the refreshed queue page instead.
  revalidatePath("/admin", "layout");
  revalidatePath("/submissions");
  revalidatePath("/challenge-leaderboard");
  revalidatePath("/wallet");
  revalidatePath("/dashboard");
  redirect(`/admin/review?reviewed=${error ? "already" : decision}`);
}

// ---------------------------------------------------------------- users

export async function changeUserRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAdminOrNull();
  if (!admin) return forbidden;
  const parsed = parseRoleForm(formData);
  if (!parsed.success) return fail("Invalid request.", parsed.fieldErrors);
  if (parsed.data.userId === admin.user.id) return fail("You cannot change your own role.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", { p_user_id: parsed.data.userId, p_role: parsed.data.role });
  if (error) return dbError(error, "changeUserRole");

  revalidatePath("/admin", "layout");
  return ok(parsed.data.role === "admin" ? "User promoted to admin." : "Admin changed to user.");
}

export async function adjustCoins(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAdminOrNull();
  if (!admin) return forbidden;
  const parsed = parseAdjustForm(formData);
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.fieldErrors);
  if (parsed.data.userId === admin.user.id) return fail("You cannot adjust your own balance.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_adjust_coins", {
    p_user_id: parsed.data.userId,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  });
  if (error) return dbError(error, "adjustCoins");

  revalidatePath("/admin", "layout");
  return ok(`Balance updated. New balance: ${Number(data).toLocaleString("en")} coins.`);
}
