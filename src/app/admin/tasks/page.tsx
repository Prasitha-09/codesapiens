import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TaskStatusBadge } from "@/components/admin/task-status-badge";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { H1 } from "@/components/ui/typography";
import { listAllTasks } from "@/lib/admin/data";
import { formatDeadline } from "@/lib/tasks/deadline";

export const metadata: Metadata = { title: "Tasks" };

export default function AdminTasksPage() {
  return (
    <Container className="flex flex-col gap-8 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <H1 className="text-3xl sm:text-4xl">Tasks</H1>
        <ButtonLink href="/admin/tasks/new">New task</ButtonLink>
      </div>
      <Suspense fallback={<PageLoading />}>
        <TaskTable />
      </Suspense>
    </Container>
  );
}

async function TaskTable() {
  const result = await listAllTasks();
  if (!result.ok) {
    return (
      <Alert tone="danger" title="Tasks unavailable">
        We couldn&apos;t load tasks. Please refresh the page.
      </Alert>
    );
  }
  if (result.data.length === 0) {
    return <Alert tone="info">No tasks yet. Create the first one.</Alert>;
  }

  return (
    <div className="overflow-x-auto border-[3px] border-ink bg-surface shadow-brutal">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b-[3px] border-ink bg-muted font-mono text-xs uppercase tracking-wider">
          <tr>
            <th scope="col" className="p-3">Task</th>
            <th scope="col" className="p-3">Status</th>
            <th scope="col" className="p-3">Reward</th>
            <th scope="col" className="p-3">Deadline (UTC)</th>
            <th scope="col" className="p-3">Pending</th>
          </tr>
        </thead>
        <tbody>
          {result.data.map((t) => (
            <tr key={t.id} className="border-b border-ink/20 last:border-0">
              <td className="p-3">
                <Link href={`/admin/tasks/${t.id}`} className="font-bold underline-offset-4 hover:underline">
                  {t.title}
                </Link>
                {t.evidence_required && (
                  <Badge tone="sky" className="ml-2">
                    File
                  </Badge>
                )}
              </td>
              <td className="p-3">
                <TaskStatusBadge status={t.status} />
              </td>
              <td className="p-3 font-mono">{t.reward_coins}</td>
              <td className="p-3 font-mono text-xs">{t.deadline ? formatDeadline(t.deadline) : "—"}</td>
              <td className="p-3">
                {t.pending > 0 ? (
                  <Link href="/admin/submissions" className="font-bold underline">
                    {t.pending}
                  </Link>
                ) : (
                  "0"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
