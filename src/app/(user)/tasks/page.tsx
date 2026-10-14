import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { SubmissionStatusBadge } from "@/components/tasks/submission-status";
import { TaskMeta } from "@/components/tasks/task-meta";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { listActiveTasks, listMySubmissions } from "@/lib/tasks/data";
import type { SubmissionStatus } from "@/types/database";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="Available tasks"
        description="Pick a task, complete it and submit your proof to earn coins."
        actions={
          <ButtonLink href="/submissions" variant="secondary">
            My submissions
          </ButtonLink>
        }
      />
      <Suspense fallback={<PageLoading />}>
        <TaskList />
      </Suspense>
    </>
  );
}

async function TaskList() {
  const [tasks, submissions] = await Promise.all([listActiveTasks(), listMySubmissions()]);

  if (tasks.status !== "ok" || submissions.status !== "ok") {
    const schemaMissing = tasks.status === "schema-missing" || submissions.status === "schema-missing";
    return (
      <Container className="py-12">
        <Alert tone={schemaMissing ? "warning" : "danger"} title="Tasks unavailable">
          {schemaMissing
            ? "The database is missing the latest task changes. Apply migration 4 (see the README)."
            : "We couldn't load tasks. Please refresh the page."}
        </Alert>
      </Container>
    );
  }

  if (tasks.data.length === 0) {
    return (
      <Container className="py-12">
        <Alert tone="info" title="No tasks yet">
          There are no active tasks right now. Check back soon.
        </Alert>
      </Container>
    );
  }

  // Latest submission status per task (list is newest first).
  const myStatus = new Map<string, SubmissionStatus>();
  for (const s of submissions.data) if (!myStatus.has(s.task_id)) myStatus.set(s.task_id, s.status);
  const now = new Date();

  return (
    <Container className="py-12">
      <ul className="grid list-none gap-6 md:grid-cols-2">
        {tasks.data.map((task) => {
          const status = myStatus.get(task.id);
          return (
            <li key={task.id}>
              <Link href={`/tasks/${task.id}`} className="block h-full focus-visible:outline-offset-4">
                <Card interactive className="flex h-full flex-col">
                  <CardBody className="flex flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-xl font-bold leading-tight">{task.title}</h2>
                      {status && <SubmissionStatusBadge status={status} />}
                    </div>
                    <p className="line-clamp-3 text-sm text-subtle">{task.description}</p>
                    <div className="mt-auto pt-2">
                      <TaskMeta
                        reward={task.reward_coins}
                        deadline={task.deadline}
                        evidenceRequired={task.evidence_required}
                        now={now}
                      />
                    </div>
                  </CardBody>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
