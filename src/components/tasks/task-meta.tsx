import { Badge } from "@/components/ui/badge";
import { formatDeadline, isPastDeadline, relativeDeadline } from "@/lib/tasks/deadline";

type TaskMetaProps = {
  reward: number;
  deadline: string | null;
  evidenceRequired: boolean;
  now: Date;
  /** Hide the reward badge when the reward is shown more prominently elsewhere. */
  hideReward?: boolean;
};

/** Reward, deadline and evidence badges shared by challenge lists and detail pages. */
export function TaskMeta({ reward, deadline, evidenceRequired, now, hideReward = false }: TaskMetaProps) {
  const closed = isPastDeadline(deadline, now);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hideReward && <Badge tone="mint">{reward.toLocaleString("en")} coins</Badge>}
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
