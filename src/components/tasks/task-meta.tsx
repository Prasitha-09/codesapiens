import { Badge } from "@/components/ui/badge";
import { formatDeadline, isPastDeadline, relativeDeadline } from "@/lib/tasks/deadline";

type TaskMetaProps = { reward: number; deadline: string | null; evidenceRequired: boolean; now: Date };

/** Reward, deadline and evidence badges shared by the task list and detail pages. */
export function TaskMeta({ reward, deadline, evidenceRequired, now }: TaskMetaProps) {
  const closed = isPastDeadline(deadline, now);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="mint">{reward.toLocaleString("en")} coins</Badge>
      {deadline ? (
        <Badge tone={closed ? "danger" : "neutral"} title={formatDeadline(deadline)}>
          {relativeDeadline(deadline, now)}
        </Badge>
      ) : (
        <Badge>No deadline</Badge>
      )}
      {evidenceRequired && <Badge tone="sky">File required</Badge>}
    </div>
  );
}
