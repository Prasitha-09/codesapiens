import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { H1 } from "@/components/ui/typography";
import { listAudit } from "@/lib/admin/data";
import { formatDeadline } from "@/lib/tasks/deadline";
import { cn } from "@/lib/utils";
import type { AuditAction } from "@/types/database";

export const metadata: Metadata = { title: "Audit log" };

const ACTIONS: { value: AuditAction; label: string; tone: BadgeTone }[] = [
  { value: "submission.approved", label: "Approved", tone: "mint" },
  { value: "submission.rejected", label: "Rejected", tone: "danger" },
  { value: "coins.adjusted", label: "Coins adjusted", tone: "sun" },
  { value: "profile.role_changed", label: "Role changed", tone: "pink" },
  { value: "task.created", label: "Task created", tone: "sky" },
  { value: "task.updated", label: "Task updated", tone: "neutral" },
];

export default function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <Container className="flex flex-col gap-6 py-10">
      <div className="flex flex-col gap-2">
        <H1 className="text-3xl sm:text-4xl">Audit log</H1>
        <p className="text-subtle">
          Permanent record of administrative actions. Entries are written by the database and cannot be edited or
          deleted.
        </p>
      </div>
      <Suspense fallback={<PageLoading />}>
        <Log searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

function summarize(action: AuditAction, d: Record<string, unknown>): string {
  const s = (v: unknown) => (v === null || v === undefined ? "—" : String(v));
  switch (action) {
    case "submission.approved":
      return `Approved, ${s(d.reward_coins)} coins credited${d.note ? ` · “${s(d.note)}”` : ""}`;
    case "submission.rejected":
      return `Rejected · “${s(d.note)}”`;
    case "coins.adjusted":
      return `${Number(d.amount) > 0 ? "+" : ""}${s(d.amount)} coins (${s(d.balance_before)} → ${s(d.balance_after)}) · “${s(d.reason)}”`;
    case "profile.role_changed":
      return `${s(d.from)} → ${s(d.to)}`;
    case "task.created":
      return `“${s(d.title)}” · ${s(d.reward_coins)} coins · ${s(d.status)}`;
    case "task.updated": {
      const before = (d.before ?? {}) as Record<string, unknown>;
      const after = (d.after ?? {}) as Record<string, unknown>;
      const changed = Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
      return changed.length
        ? changed.map((k) => `${k}: ${s(before[k])} → ${s(after[k])}`).join(" · ")
        : "No field changes";
    }
  }
}

async function Log({ searchParams }: Pick<PageProps<"/admin/audit">, "searchParams">) {
  const query = await searchParams;
  const action = ACTIONS.find((a) => a.value === query.action)?.value ?? null;
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const result = await listAudit(page, action);

  const href = (p: { action?: string | null; page?: number }) => {
    const params = new URLSearchParams();
    const a = p.action === undefined ? action : p.action;
    if (a) params.set("action", a);
    if (p.page && p.page > 1) params.set("page", String(p.page));
    const qs = params.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Filter by action" className="flex flex-wrap gap-2">
        {[{ value: null, label: "All" }, ...ACTIONS].map((a) => (
          <Link
            key={a.value ?? "all"}
            href={href({ action: a.value, page: 1 })}
            aria-current={a.value === action ? "page" : undefined}
            className={cn(
              "rounded-brutal border-[3px] border-ink px-3 py-1 text-xs font-bold uppercase",
              a.value === action ? "bg-mint text-on-accent shadow-brutal-sm" : "bg-surface",
            )}
          >
            {a.label}
          </Link>
        ))}
      </nav>

      {!result.ok ? (
        <Alert tone="danger" title="Audit log unavailable">
          We couldn&apos;t load the audit log. Please refresh the page.
        </Alert>
      ) : result.data.items.length === 0 ? (
        <Alert tone="info">No entries.</Alert>
      ) : (
        <ol className="flex list-none flex-col border-[3px] border-ink bg-surface shadow-brutal">
          {result.data.items.map((e) => {
            const meta = ACTIONS.find((a) => a.value === e.action);
            return (
              <li key={e.id} className="flex flex-col gap-1 border-b border-ink/20 p-4 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={meta?.tone ?? "neutral"}>{meta?.label ?? e.action}</Badge>
                  <span className="font-mono text-xs">{formatDeadline(e.created_at)}</span>
                  <span className="text-sm">
                    by <strong>{e.actor ? `@${e.actor}` : e.actor_id ? "deleted user" : "system / SQL"}</strong>
                  </span>
                </div>
                <p className="break-words text-sm">
                  {summarize(e.action, (e.details ?? {}) as Record<string, unknown>)}
                </p>
                <p className="font-mono text-xs text-subtle">
                  {e.target_type} {e.target_id}
                  {e.target_type === "task" && (
                    <>
                      {" · "}
                      <Link href={`/admin/tasks/${e.target_id}`} className="underline">
                        open
                      </Link>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {result.ok && (page > 1 || result.data.hasMore) && (
        <nav aria-label="Pages" className="flex gap-3">
          {page > 1 && (
            <Link href={href({ page: page - 1 })} className={buttonStyles({ size: "sm", variant: "secondary" })}>
              ← Newer
            </Link>
          )}
          {result.data.hasMore && (
            <Link href={href({ page: page + 1 })} className={buttonStyles({ size: "sm", variant: "secondary" })}>
              Older →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
