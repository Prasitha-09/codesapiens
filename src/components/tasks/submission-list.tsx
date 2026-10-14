import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import type { MySubmission } from "@/lib/tasks/data";
import { formatDeadline } from "@/lib/tasks/deadline";
import { SubmissionStatusBadge } from "./submission-status";

type SubmissionListProps = {
  submissions: MySubmission[];
  /** When given, each item shows (and links to) its task. */
  tasks?: Map<string, { title: string; reward_coins: number }>;
};

export function SubmissionList({ submissions, tasks }: SubmissionListProps) {
  return (
    <ol className="flex list-none flex-col gap-4">
      {submissions.map((s) => {
        const task = tasks?.get(s.task_id);
        return (
          <li key={s.id}>
            <Card>
              <CardBody className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {tasks && (
                      <Link
                        href={`/tasks/${s.task_id}`}
                        className="truncate text-lg font-bold underline-offset-4 hover:underline"
                      >
                        {task?.title ?? "Task no longer available"}
                      </Link>
                    )}
                    <p className="font-mono text-xs text-subtle">
                      Submitted {formatDeadline(s.created_at)}
                      {s.reviewed_at && ` · Reviewed ${formatDeadline(s.reviewed_at)}`}
                    </p>
                  </div>
                  <SubmissionStatusBadge status={s.status} />
                </div>

                {s.proof_text && <p className="whitespace-pre-line break-words text-sm">{s.proof_text}</p>}

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold">
                  {s.proof_url && (
                    <a
                      href={s.proof_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="max-w-full truncate underline underline-offset-4"
                    >
                      Proof link ↗
                    </a>
                  )}
                  {s.has_evidence && (
                    <a
                      href={`/submissions/${s.id}/evidence`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      View private evidence ↗
                    </a>
                  )}
                </div>

                {s.review_note && (
                  <p className="border-l-[3px] border-ink bg-muted px-3 py-2 text-sm">
                    <span className="font-bold">Reviewer note: </span>
                    {s.review_note}
                  </p>
                )}
                {s.status === "approved" && <p className="text-sm font-bold">Reward credited to your coins.</p>}
              </CardBody>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
