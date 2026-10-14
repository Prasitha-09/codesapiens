import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { SubmissionStatus } from "@/types/database";

const tones: Record<SubmissionStatus, BadgeTone> = { pending: "sun", approved: "mint", rejected: "danger" };
const labels: Record<SubmissionStatus, string> = { pending: "Pending review", approved: "Approved", rejected: "Rejected" };

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}
