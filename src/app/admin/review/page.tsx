import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReviewActions } from "@/components/admin/review-actions";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { SubmissionStatusBadge } from "@/components/tasks/submission-status";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { H1 } from "@/components/ui/typography";
import { listSubmissionsForReview } from "@/lib/admin/data";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDeadline } from "@/lib/tasks/deadline";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@/types/database";

export const metadata: Metadata = { title: "Review submissions" };

const TABS: { status: SubmissionStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
];

export default function AdminSubmissionsPage({ searchParams }: PageProps<"/admin/review">) {
  return (
    <Container className="flex flex-col gap-6 py-10">
      <H1 className="text-3xl sm:text-4xl">Review submissions</H1>
      <Suspense fallback={<PageLoading />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Queue({ searchParams }: Pick<PageProps<"/admin/review">, "searchParams">) {
  const query = await searchParams;
  const status: SubmissionStatus = TABS.some((t) => t.status === query.status)
    ? (query.status as SubmissionStatus)
    : "pending";

  const [result, me] = await Promise.all([listSubmissionsForReview(status), getCurrentUser()]);

  const reviewed = {
    approved: { tone: "success" as const, text: "Approved — the reward was credited to the user." },
    rejected: { tone: "success" as const, text: "Rejected — the user can see your reason." },
    already: {
      tone: "warning" as const,
      text: "That submission had already been reviewed (possibly by another admin). Nothing was changed.",
    },
  }[String(query.reviewed)];

  return (
    <div className="flex flex-col gap-6">
      {reviewed && (
        <Alert tone={reviewed.tone} role="status">
          {reviewed.text}
        </Alert>
      )}
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={`/admin/review?status=${t.status}`}
            aria-current={t.status === status ? "page" : undefined}
            className={cn(
              "rounded-brutal border-[3px] border-ink px-3 py-1.5 text-sm font-bold uppercase",
              t.status === status ? "bg-mint text-on-accent shadow-brutal-sm" : "bg-surface",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {!result.ok ? (
        <Alert tone="danger" title="Submissions unavailable">
          We couldn&apos;t load submissions. Please refresh the page.
        </Alert>
      ) : result.data.length === 0 ? (
        <Alert tone="info">{status === "pending" ? "Nothing to review — the queue is empty." : "No submissions here yet."}</Alert>
      ) : (
        <ol className="flex list-none flex-col gap-4">
          {result.data.map((s) => {
            const own = s.user_id === me?.id;
            return (
              <li key={s.id}>
                <Card>
                  <CardBody className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/tasks/${s.task_id}`}
                          className="text-lg font-bold underline-offset-4 hover:underline"
                        >
                          {s.task?.title ?? "Unknown task"}
                        </Link>
                        <SubmissionStatusBadge status={s.status} />
                        {s.task && <span className="font-mono text-xs">{s.task.reward_coins} coins</span>}
                      </div>
                      <p className="font-mono text-xs text-subtle">
                        by @{s.submitter?.username ?? "unknown"} · submitted {formatDeadline(s.created_at)}
                        {s.reviewed_at && ` · reviewed ${formatDeadline(s.reviewed_at)} by @${s.reviewer ?? "unknown"}`}
                      </p>
                      {s.proof_text && <p className="whitespace-pre-line break-words text-sm">{s.proof_text}</p>}
                      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold">
                        {s.proof_url && (
                          <a href={s.proof_url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                            Proof link ↗
                          </a>
                        )}
                        {s.has_evidence && (
                          <a
                            href={`/submissions/${s.id}/evidence`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            Private evidence ↗
                          </a>
                        )}
                      </div>
                      {s.review_note && (
                        <p className="border-l-[3px] border-ink bg-muted px-3 py-2 text-sm">
                          <span className="font-bold">Note: </span>
                          {s.review_note}
                        </p>
                      )}
                    </div>
                    {s.status === "pending" && (
                      <div className="flex flex-col gap-2 border-t-[3px] border-dashed border-ink/30 pt-4 lg:border-l-[3px] lg:border-t-0 lg:pl-5 lg:pt-0">
                        {own ? (
                          <Alert tone="info">This is your own submission — another admin must review it.</Alert>
                        ) : (
                          <ReviewActions submissionId={s.id} />
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
      {result.ok && result.data.length === 50 && (
        <p className="text-sm text-subtle">Showing the first 50. Review these to see more.</p>
      )}
    </div>
  );
}
