import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { SubmissionList } from "@/components/tasks/submission-list";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { getTaskTitles, listMySubmissions } from "@/lib/tasks/data";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@/types/database";

export const metadata: Metadata = { title: "My Attempts" };

const FILTERS: { key: "all" | SubmissionStatus; label: string; tone: string }[] = [
  { key: "all", label: "All", tone: "bg-mint" },
  { key: "pending", label: "Pending", tone: "bg-sun" },
  { key: "approved", label: "Approved", tone: "bg-mint" },
  { key: "rejected", label: "Rejected", tone: "bg-danger" },
];

export default function MyAttemptsPage({ searchParams }: PageProps<"/submissions">) {
  return (
    <>
      <PageHeader
        eyebrow="Challenge history"
        title="My Attempts"
        description="Everything you've submitted, when you submitted it, and what the organizers decided."
        actions={<ButtonLink href="/tasks">Explore Challenges</ButtonLink>}
      />
      <Suspense fallback={<PageLoading />}>
        <History searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function History({ searchParams }: Pick<PageProps<"/submissions">, "searchParams">) {
  const query = await searchParams;
  const filter = FILTERS.find((f) => f.key === query.status)?.key ?? "all";
  const submissions = await listMySubmissions();

  if (submissions.status !== "ok") {
    return (
      <Container className="py-12">
        <Alert tone={submissions.status === "schema-missing" ? "warning" : "danger"} title="Attempts unavailable">
          {submissions.status === "schema-missing"
            ? "The database is missing the latest changes. Apply the migrations listed in the README."
            : "We couldn't load your attempts. Please refresh the page."}
        </Alert>
      </Container>
    );
  }

  const all = submissions.data;
  const counts = {
    all: all.length,
    pending: all.filter((s) => s.status === "pending").length,
    approved: all.filter((s) => s.status === "approved").length,
    rejected: all.filter((s) => s.status === "rejected").length,
  };

  if (all.length === 0) {
    return (
      <Container className="py-12">
        <div className="border-[3px] border-dashed border-ink/40 p-10 text-center">
          <p className="font-display text-3xl uppercase">No attempts yet</p>
          <p className="mt-2 text-subtle">Pick a challenge and submit your work to get started.</p>
          <div className="mt-6 flex justify-center">
            <ButtonLink href="/tasks">Explore Challenges</ButtonLink>
          </div>
        </div>
      </Container>
    );
  }

  const visible = filter === "all" ? all : all.filter((s) => s.status === filter);
  const titles = await getTaskTitles([...new Set(visible.map((s) => s.task_id))]);

  return (
    <Container className="flex flex-col gap-8 py-12">
      <nav aria-label="Filter by status" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/submissions" : `/submissions?status=${f.key}`}
            aria-current={f.key === filter ? "page" : undefined}
            className={cn(
              "flex items-center justify-between gap-2 border-[3px] border-ink p-4 transition-transform hover:-translate-y-0.5",
              f.key === filter ? `${f.tone} text-on-accent shadow-brutal` : "bg-surface",
            )}
          >
            <span className="font-bold uppercase tracking-wider">{f.label}</span>
            <span className="font-display text-3xl leading-none">{counts[f.key]}</span>
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <p className="text-subtle">No {filter} attempts.</p>
      ) : (
        <SubmissionList submissions={visible} tasks={titles} />
      )}
    </Container>
  );
}
