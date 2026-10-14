import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { SubmissionList } from "@/components/tasks/submission-list";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { getTaskTitles, listMySubmissions } from "@/lib/tasks/data";

export const metadata: Metadata = { title: "My submissions" };

export default function SubmissionsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Submissions"
        title="My submissions"
        description="Everything you've submitted and where it stands."
        actions={<ButtonLink href="/tasks">Browse tasks</ButtonLink>}
      />
      <Suspense fallback={<PageLoading />}>
        <History />
      </Suspense>
    </>
  );
}

async function History() {
  const submissions = await listMySubmissions();

  if (submissions.status !== "ok") {
    return (
      <Container className="py-12">
        <Alert tone={submissions.status === "schema-missing" ? "warning" : "danger"} title="Submissions unavailable">
          {submissions.status === "schema-missing"
            ? "The database is missing the latest task changes. Apply migration 4 (see the README)."
            : "We couldn't load your submissions. Please refresh the page."}
        </Alert>
      </Container>
    );
  }

  if (submissions.data.length === 0) {
    return (
      <Container className="py-12">
        <Alert tone="info" title="No submissions yet">
          Pick a task and submit your proof to get started.
        </Alert>
      </Container>
    );
  }

  const titles = await getTaskTitles([...new Set(submissions.data.map((s) => s.task_id))]);

  return (
    <Container className="py-12">
      <SubmissionList submissions={submissions.data} tasks={titles} />
    </Container>
  );
}
