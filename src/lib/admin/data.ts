import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { AuditAction, AuditLog, SubmissionStatus, Task, TaskSubmission } from "@/types/database";

/**
 * Admin reads. Every function calls requireAdmin() first (404 for non-admins)
 * and then reads with the admin's own session, so RLS/is_admin() in the
 * database independently enforce the same rule.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; schemaMissing: boolean };

function fail(error: { code?: string; message?: string }, what: string): { ok: false; schemaMissing: boolean } {
  const schemaMissing = error.code === "PGRST202" || error.code === "PGRST205" || error.code === "42703";
  if (!schemaMissing) console.error(`admin: failed to load ${what}`, error.code);
  return { ok: false, schemaMissing };
}

export type DashboardStats = {
  users_total: number;
  admins_total: number;
  users_new_7d: number;
  tasks_draft: number;
  tasks_active: number;
  tasks_archived: number;
  submissions_pending: number;
  submissions_approved: number;
  submissions_rejected: number;
  oldest_pending_at: string | null;
  reviews_7d: number;
  coins_rewarded: number;
  coins_adjusted: number;
  coins_in_circulation: number;
};

export async function getDashboardStats(): Promise<Result<DashboardStats>> {
  await requireAdmin("/admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard_stats");
  if (error) return fail(error, "stats");
  return { ok: true, data: data as DashboardStats };
}

export type AdminTaskRow = Task & { pending: number };

export async function listAllTasks(): Promise<Result<AdminTaskRow[]>> {
  await requireAdmin("/admin/tasks");
  const supabase = await createClient();
  const [tasks, pending] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("task_submissions").select("task_id").eq("status", "pending"),
  ]);
  if (tasks.error) return fail(tasks.error, "tasks");
  if (pending.error) return fail(pending.error, "pending counts");
  const counts = new Map<string, number>();
  for (const row of pending.data) counts.set(row.task_id, (counts.get(row.task_id) ?? 0) + 1);
  return { ok: true, data: tasks.data.map((t) => ({ ...t, pending: counts.get(t.id) ?? 0 })) };
}

export async function getTaskForAdmin(id: string): Promise<Result<Task | null>> {
  await requireAdmin(`/admin/tasks/${id}`);
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (error) return fail(error, "task");
  return { ok: true, data };
}

export type ReviewItem = Omit<TaskSubmission, "evidence_path"> & {
  has_evidence: boolean;
  task: { title: string; reward_coins: number } | null;
  submitter: { username: string; display_name: string | null } | null;
  reviewer: string | null;
};

/** Submissions by status: pending oldest-first (a fair queue), others newest-first. */
export async function listSubmissionsForReview(status: SubmissionStatus, limit = 50): Promise<Result<ReviewItem[]>> {
  await requireAdmin("/admin/submissions");
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("task_submissions")
    .select("*")
    .eq("status", status)
    .order(status === "pending" ? "created_at" : "reviewed_at", { ascending: status === "pending" })
    .limit(limit);
  if (error) return fail(error, "submissions");

  const taskIds = [...new Set(rows.map((r) => r.task_id))];
  const userIds = [...new Set(rows.flatMap((r) => [r.user_id, r.reviewed_by].filter((v): v is string => !!v)))];
  const [tasks, profiles] = await Promise.all([
    taskIds.length
      ? supabase.from("tasks").select("id, title, reward_coins").in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from("profiles").select("id, username, display_name").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (tasks.error) return fail(tasks.error, "task titles");
  if (profiles.error) return fail(profiles.error, "profiles");

  const taskMap = new Map(tasks.data.map((t) => [t.id, t]));
  const profileMap = new Map(profiles.data.map((p) => [p.id, p]));
  return {
    ok: true,
    data: rows.map(({ evidence_path, ...r }) => ({
      ...r,
      has_evidence: evidence_path !== null,
      task: taskMap.get(r.task_id) ?? null,
      submitter: profileMap.get(r.user_id) ?? null,
      reviewer: r.reviewed_by ? (profileMap.get(r.reviewed_by)?.username ?? null) : null,
    })),
  };
}

export const USERS_PAGE_SIZE = 25;

export type AdminUser = {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  role: "user" | "admin";
  is_public: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  coins: number;
  submissions: number;
  approved: number;
};

export async function listUsers(search: string, page: number): Promise<Result<{ users: AdminUser[]; total: number }>> {
  await requireAdmin("/admin/users");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: search || null,
    p_limit: USERS_PAGE_SIZE,
    p_offset: (page - 1) * USERS_PAGE_SIZE,
  });
  if (error) return fail(error, "users");
  return {
    ok: true,
    data: {
      users: data.map((row) => {
        const user: AdminUser & { total_count?: number } = { ...row };
        delete user.total_count;
        return user;
      }),
      total: data[0]?.total_count ?? 0,
    },
  };
}

export const AUDIT_PAGE_SIZE = 50;

export type AuditItem = AuditLog & { actor: string | null };

export async function listAudit(page: number, action: AuditAction | null): Promise<Result<{ items: AuditItem[]; hasMore: boolean }>> {
  await requireAdmin("/admin/audit");
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE); // one extra row → hasMore
  if (action) query = query.eq("action", action);
  const { data, error } = await query;
  if (error) return fail(error, "audit log");

  const items = data.slice(0, AUDIT_PAGE_SIZE);
  const actorIds = [...new Set(items.map((i) => i.actor_id).filter((v): v is string => !!v))];
  const actors = actorIds.length
    ? await supabase.from("profiles").select("id, username").in("id", actorIds)
    : { data: [], error: null };
  if (actors.error) return fail(actors.error, "audit actors");
  const names = new Map(actors.data.map((a) => [a.id, a.username]));

  return {
    ok: true,
    data: {
      items: items.map((i) => ({ ...i, actor: i.actor_id ? (names.get(i.actor_id) ?? null) : null })),
      hasMore: data.length > AUDIT_PAGE_SIZE,
    },
  };
}
