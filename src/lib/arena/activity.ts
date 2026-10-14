import type { LedgerRow } from "@/lib/coins/ledger";
import type { MySubmission } from "@/lib/tasks/data";

/**
 * Recent-activity feed for My Arena, built only from stored records: the
 * user's own submissions (submitted / reviewed timestamps) and coin ledger rows.
 */

export type ActivityEvent = {
  id: string;
  at: string;
  kind: "submitted" | "approved" | "rejected" | "coins";
  title: string;
  detail: string | null;
  href: string | null;
  amount: number | null;
};

export function buildActivity(
  submissions: MySubmission[],
  ledger: LedgerRow[],
  taskTitles: Map<string, { title: string }>,
  limit = 8,
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const s of submissions) {
    const title = taskTitles.get(s.task_id)?.title ?? "a challenge";
    const href = `/tasks/${s.task_id}`;
    events.push({ id: `s-${s.id}`, at: s.created_at, kind: "submitted", title, detail: null, href, amount: null });
    if (s.reviewed_at && (s.status === "approved" || s.status === "rejected")) {
      events.push({
        id: `r-${s.id}`,
        at: s.reviewed_at,
        kind: s.status,
        title,
        detail: s.status === "rejected" ? s.review_note : null,
        href,
        amount: null,
      });
    }
  }

  for (const row of ledger) {
    events.push({
      id: `c-${row.id}`,
      at: row.created_at,
      kind: "coins",
      title: row.kind === "task_reward" ? (row.task_title ?? "Challenge reward") : "Coin adjustment",
      detail: row.kind === "admin_adjustment" ? row.reason : null,
      href: "/wallet",
      amount: row.amount,
    });
  }

  // Newest first. Events at the same moment (an approval and the reward it
  // paid) show the outcome above its cause.
  const tieOrder: Record<ActivityEvent["kind"], number> = { coins: 0, approved: 1, rejected: 1, submitted: 2 };
  return events
    .sort(
      (a, b) =>
        new Date(b.at).getTime() - new Date(a.at).getTime() ||
        tieOrder[a.kind] - tieOrder[b.kind] ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit);
}
