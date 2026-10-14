import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { ChallengeCard } from "@/components/tasks/challenge-card";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { listActiveTasks, listMySubmissions } from "@/lib/tasks/data";
import { isPastDeadline } from "@/lib/tasks/deadline";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@/types/database";

export const metadata: Metadata = { title: "Explore Challenges" };

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "todo", label: "Not attempted" },
  { key: "attempted", label: "Attempted" },
  { key: "closed", label: "Closed" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

export default function ChallengesPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <>
      <PageHeader
        eyebrow="Challenges"
        title="Explore Challenges"
        description="Pick a challenge, do the work and submit your proof. Coins are awarded once an organizer approves it."
        actions={
          <ButtonLink href="/submissions" variant="secondary">
            My Attempts
          </ButtonLink>
        }
      />
      <Suspense fallback={<PageLoading />}>
        <ChallengeBoard searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ChallengeBoard({ searchParams }: Pick<PageProps<"/tasks">, "searchParams">) {
  const query = await searchParams;
  const filter: FilterKey = FILTERS.some((f) => f.key === query.show) ? (query.show as FilterKey) : "open";
  const [tasks, submissions] = await Promise.all([listActiveTasks(), listMySubmissions()]);

  if (tasks.status !== "ok" || submissions.status !== "ok") {
    const schemaMissing = tasks.status === "schema-missing" || submissions.status === "schema-missing";
    return (
      <Container className="py-12">
        <Alert tone={schemaMissing ? "warning" : "danger"} title="Challenges unavailable">
          {schemaMissing
            ? "The database is missing the latest changes. Apply the migrations listed in the README."
            : "We couldn't load challenges. Please refresh the page."}
        </Alert>
      </Container>
    );
  }

  // Latest attempt status per challenge (list is newest first).
  const myStatus = new Map<string, SubmissionStatus>();
  for (const s of submissions.data) if (!myStatus.has(s.task_id)) myStatus.set(s.task_id, s.status);
  const now = new Date();

  const counts: Record<FilterKey, number> = { open: 0, todo: 0, attempted: 0, closed: 0 };
  const matches = (key: FilterKey, t: (typeof tasks.data)[number]) => {
    const closed = isPastDeadline(t.deadline, now);
    const attempted = myStatus.has(t.id);
    if (key === "open") return !closed;
    if (key === "todo") return !closed && !attempted;
    if (key === "attempted") return attempted;
    return closed;
  };
  for (const t of tasks.data) for (const f of FILTERS) if (matches(f.key, t)) counts[f.key]++;
  const visible = tasks.data.filter((t) => matches(filter, t));

  const empty: Record<FilterKey, string> = {
    open: "There are no open challenges right now. New ones appear here as soon as they're published.",
    todo: "You've attempted every open challenge. Nice work.",
    attempted: "You haven't attempted any challenges yet.",
    closed: "No challenges have closed yet.",
  };

  return (
    <Container className="flex flex-col gap-8 py-12">
      <nav aria-label="Filter challenges" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "open" ? "/tasks" : `/tasks?show=${f.key}`}
            aria-current={f.key === filter ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 border-[3px] border-ink px-3 py-1.5 text-sm font-bold uppercase tracking-wider",
              f.key === filter ? "bg-mint text-on-accent shadow-brutal-sm" : "bg-surface hover:bg-muted",
            )}
          >
            {f.label}
            <span className="font-mono text-xs">{counts[f.key]}</span>
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <div className="border-[3px] border-dashed border-ink/40 p-10 text-center">
          <p className="font-display text-3xl uppercase">Nothing here</p>
          <p className="mt-2 text-subtle">{empty[filter]}</p>
        </div>
      ) : (
        <ul className="grid list-none gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((task, i) => (
            <li key={task.id}>
              <ChallengeCard task={task} index={i + 1} status={myStatus.get(task.id)} now={now} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
