import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { TaskStatus } from "@/types/database";

const tones: Record<TaskStatus, BadgeTone> = { draft: "neutral", active: "mint", archived: "ink" };

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={tones[status]}>{status}</Badge>;
}
