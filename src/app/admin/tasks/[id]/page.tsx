import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TaskForm } from "@/components/admin/task-form";
import { TaskStatusBadge } from "@/components/admin/task-status-badge";
import { TaskStatusControls } from "@/components/admin/task-status-controls";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { H1 } from "@/components/ui/typography";
import { setTaskStatus, updateTask } from "@/lib/admin/actions";
import { getTaskForAdmin } from "@/lib/admin/data";
import { isoToDatetimeLocal } from "@/lib/admin/validation";
import { formatDeadline } from "@/lib/tasks/deadline";

export const metadata: Metadata = { title: "Edit task" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditTaskPage({ params, searchParams }: PageProps<"/admin/tasks/[id]">) {
  return (
    <Container className="flex flex-col gap-6 py-10">
      <Link href="/admin/tasks" className="font-mono text-sm font-bold underline-offset-4 hover:underline">
        ← All tasks
      </Link>
      <Suspense fallback={<PageLoading />}>
        <Editor params={params} searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Editor({
  params,
  searchParams,
}: Pick<PageProps<"/admin/tasks/[id]">, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();

  const result = await getTaskForAdmin(id);
  if (!result.ok) {
    return (
      <Alert tone="danger" title="Task unavailable">
        We couldn&apos;t load this task. Please refresh the page.
      </Alert>
    );
  }
  const task = result.data;
  if (!task) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <H1 className="break-words text-3xl sm:text-4xl">{task.title}</H1>
        <TaskStatusBadge status={task.status} />
      </div>
      {query.created === "1" && (
        <Alert tone="success" role="status">
          Task created as <strong>{task.status}</strong>.
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <TaskForm
          action={updateTask.bind(null, task.id)}
          submitLabel="Save changes"
          initial={{
            title: task.title,
            description: task.description,
            requirements: task.requirements ?? "",
            reward_coins: String(task.reward_coins),
            deadline: isoToDatetimeLocal(task.deadline),
            evidence_required: task.evidence_required,
            status: task.status,
          }}
        />

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <p className="text-sm text-subtle">
                Drafts are hidden from users. Archived tasks stop accepting submissions. Existing submissions and
                rewards are never changed.
              </p>
              <TaskStatusControls status={task.status} action={setTaskStatus.bind(null, task.id)} />
            </CardBody>
          </Card>

          <Card tone="muted">
            <CardBody className="flex flex-col gap-1 font-mono text-xs">
              <p>Created {formatDeadline(task.created_at)}</p>
              <p>Updated {formatDeadline(task.updated_at)}</p>
              <p>
                <Link href={`/admin/audit?action=task.updated`} className="underline">
                  Change history →
                </Link>
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
