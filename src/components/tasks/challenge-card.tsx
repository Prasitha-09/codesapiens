import Link from "next/link";
import type { TaskSummary } from "@/lib/tasks/data";
import { isPastDeadline } from "@/lib/tasks/deadline";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@/types/database";
import { SubmissionStatusBadge } from "./submission-status";
import { TaskMeta } from "./task-meta";

type ChallengeCardProps = {
  task: TaskSummary;
  /** Display number (e.g. its position in the list). */
  index: number;
  /** The viewer's latest attempt status for this challenge, if any. */
  status?: SubmissionStatus;
  now: Date;
};

/** Clickable challenge tile: number, title, summary, reward/deadline badges and your status. */
export function ChallengeCard({ task, index, status, now }: ChallengeCardProps) {
  const closed = isPastDeadline(task.deadline, now);
  return (
    <Link
      href={`/tasks/${task.id}`}
      className={cn(
        "group relative flex h-full flex-col gap-4 border-[3px] border-ink bg-surface p-6 shadow-brutal",
        "transition-[transform,box-shadow] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-lg",
        closed && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden="true" className="font-display text-5xl leading-none text-mint">
          {String(index).padStart(2, "0")}
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="border-[3px] border-ink bg-mint px-2 py-0.5 font-display text-2xl leading-tight text-on-accent">
            {task.reward_coins.toLocaleString("en")}
            <span className="ml-1 font-mono text-xs font-bold">COINS</span>
          </span>
        </span>
      </div>
      <h3 className="text-xl font-bold leading-tight group-hover:underline">{task.title}</h3>
      <p className="line-clamp-3 text-sm text-subtle">{task.description}</p>
      <div className="mt-auto flex flex-col gap-3 pt-2">
        <TaskMeta reward={task.reward_coins} deadline={task.deadline} evidenceRequired={task.evidence_required} now={now} hideReward />
        {status && (
          <div className="flex items-center gap-2 border-t border-ink/20 pt-3 text-sm">
            <span className="font-mono text-xs uppercase text-subtle">Your attempt</span>
            <SubmissionStatusBadge status={status} />
          </div>
        )}
      </div>
    </Link>
  );
}
