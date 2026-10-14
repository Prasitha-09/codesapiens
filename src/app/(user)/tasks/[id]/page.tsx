import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { SubmissionList } from "@/components/tasks/submission-list";
import { SubmissionPanel } from "@/components/tasks/submission-panel";
import { TaskMeta } from "@/components/tasks/task-meta";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { Eyebrow, H1, Text } from "@/components/ui/typography";
import { getActiveTask, listMySubmissions } from "@/lib/tasks/data";
import { formatDeadline, isPastDeadline } from "@/lib/tasks/deadline";

export const metadata: Metadata = { title: "Task" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <TaskDetail params={params} />
    </Suspense>
  );
}

async function TaskDetail({ params }: { params: PageProps<"/tasks/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [task, submissions] = await Promise.all([getActiveTask(id), listMySubmissions(id)]);

  if (task.status !== "ok" || submissions.status !== "ok") {
    const schemaMissing = task.status === "schema-missing" || submissions.status === "schema-missing";
    return (
      <Container className="py-12">
        <Alert tone={schemaMissing ? "warning" : "danger"} title="Task unavailable">
          {schemaMissing
            ? "The database is missing the latest task changes. Apply migration 4 (see the README)."
            : "We couldn't load this task. Please refresh the page."}
        </Alert>
      </Container>
    );
  }
  if (!task.data) notFound();

  const t = task.data;
  const now = new Date();
  const live = submissions.data.find((s) => s.status === "pending" || s.status === "approved");
  // Display-only decision; the server action and RLS enforce the same rules.
  const blockedReason = isPastDeadline(t.deadline, now)
    ? "This task's deadline has passed, so it no longer accepts submissions."
    : live?.status === "approved"
      ? "You've completed this task — your submission was approved."
      : live?.status === "pending"
        ? "You've already submitted this task. It's waiting for review."
        : null;

  return (
    <>
      <header className="border-b-[3px] border-ink bg-surface">
        <Container className="flex flex-col gap-4 py-10 sm:py-14">
          <Link href="/tasks" className="font-mono text-sm font-bold underline-offset-4 hover:underline">
            ← All tasks
          </Link>
          <Eyebrow>Task</Eyebrow>
          <H1 className="break-words">{t.title}</H1>
          <TaskMeta reward={t.reward_coins} deadline={t.deadline} evidenceRequired={t.evidence_required} now={now} />
          {t.deadline && <p className="font-mono text-sm text-subtle">Deadline: {formatDeadline(t.deadline)}</p>}
        </Container>
      </header>

      <Container className="grid gap-8 py-12 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <div className="flex flex-col gap-8">
          <section aria-labelledby="description" className="flex flex-col gap-3">
            <h2 id="description" className="text-xl font-bold uppercase tracking-wide">
              Description
            </h2>
            <Text className="whitespace-pre-line break-words">{t.description}</Text>
          </section>

          <section aria-labelledby="requirements" className="flex flex-col gap-3">
            <h2 id="requirements" className="text-xl font-bold uppercase tracking-wide">
              Submission requirements
            </h2>
            <Card tone="muted">
              <CardBody className="flex flex-col gap-2">
                {t.requirements ? (
                  <Text className="whitespace-pre-line break-words">{t.requirements}</Text>
                ) : (
                  <Text>Provide a note, a link or a file showing you completed the task.</Text>
                )}
                <Text className="text-sm font-bold">
                  {t.evidence_required ? "A file is required as evidence." : "A file is optional."}
                </Text>
              </CardBody>
            </Card>
          </section>

          <section aria-labelledby="history" className="flex flex-col gap-3">
            <h2 id="history" className="text-xl font-bold uppercase tracking-wide">
              Your submissions
            </h2>
            {submissions.data.length > 0 ? (
              <SubmissionList submissions={submissions.data} />
            ) : (
              <Text className="text-subtle">You haven&apos;t submitted this task yet.</Text>
            )}
          </section>
        </div>

        <div className="lg:sticky lg:top-24">
          <SubmissionPanel taskId={t.id} evidenceRequired={t.evidence_required} blockedReason={blockedReason} />
        </div>
      </Container>
    </>
  );
}
