import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { SubmissionList } from "@/components/tasks/submission-list";
import { SubmissionPanel } from "@/components/tasks/submission-panel";
import { SubmissionStatusBadge } from "@/components/tasks/submission-status";
import { TaskMeta } from "@/components/tasks/task-meta";
import { Alert } from "@/components/ui/alert";
import { Eyebrow, Text } from "@/components/ui/typography";
import { getActiveTask, listMySubmissions } from "@/lib/tasks/data";
import { formatDeadline, isPastDeadline } from "@/lib/tasks/deadline";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Challenge" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ChallengePage({ params }: PageProps<"/tasks/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <ChallengeDetail params={params} />
    </Suspense>
  );
}

async function ChallengeDetail({ params }: { params: PageProps<"/tasks/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [task, submissions] = await Promise.all([getActiveTask(id), listMySubmissions(id)]);

  if (task.status !== "ok" || submissions.status !== "ok") {
    const schemaMissing = task.status === "schema-missing" || submissions.status === "schema-missing";
    return (
      <Container className="py-12">
        <Alert tone={schemaMissing ? "warning" : "danger"} title="Challenge unavailable">
          {schemaMissing
            ? "The database is missing the latest changes. Apply the migrations listed in the README."
            : "We couldn't load this challenge. Please refresh the page."}
        </Alert>
      </Container>
    );
  }
  if (!task.data) notFound();

  const t = task.data;
  const now = new Date();
  const closed = isPastDeadline(t.deadline, now);
  const latest = submissions.data[0];
  const live = submissions.data.find((s) => s.status === "pending" || s.status === "approved");
  // Display-only decision; the server action and RLS enforce the same rules.
  const blockedReason = closed
    ? "This challenge's deadline has passed, so it no longer accepts submissions."
    : live?.status === "approved"
      ? "You've completed this challenge — your submission was approved."
      : live?.status === "pending"
        ? "You've already submitted this challenge. It's waiting for review."
        : null;

  const status = latest
    ? {
        pending: { tone: "bg-sun", title: "Submitted — waiting for review", body: "An organizer will review it soon." },
        approved: { tone: "bg-mint", title: "Approved", body: "The reward has been credited to My Coins." },
        rejected: {
          tone: "bg-danger",
          title: "Not approved",
          body: closed ? "The challenge has closed." : "Read the reason below and submit again before the deadline.",
        },
      }[latest.status]
    : null;

  return (
    <>
      <header className="relative overflow-hidden border-b-[3px] border-ink">
        <div aria-hidden="true" className="bg-lines absolute inset-0" />
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-2 bg-mint" />
        <Container className="relative grid gap-8 py-10 sm:py-14 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="flex min-w-0 flex-col gap-4">
            <Link href="/tasks" className="w-fit font-mono text-sm font-bold underline-offset-4 hover:underline">
              ← All challenges
            </Link>
            <Eyebrow>{closed ? "Closed challenge" : "Challenge"}</Eyebrow>
            <h1 className="break-words font-display text-5xl uppercase leading-[0.92] sm:text-6xl lg:text-7xl">{t.title}</h1>
            <TaskMeta reward={t.reward_coins} deadline={t.deadline} evidenceRequired={t.evidence_required} now={now} hideReward />
            {t.deadline && <p className="font-mono text-sm text-subtle">Deadline: {formatDeadline(t.deadline)}</p>}
          </div>
          <div className="w-fit rotate-2 border-[3px] border-ink bg-mint px-6 py-4 text-on-accent shadow-brutal-lg">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.25em]">Reward</p>
            <p className="font-display text-6xl leading-none">{t.reward_coins.toLocaleString("en")}</p>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.25em]">coins</p>
          </div>
        </Container>
      </header>

      {latest && status && (
        <div className={cn("border-b-[3px] border-ink text-on-accent", status.tone)}>
          <Container className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="flex flex-wrap items-center gap-3 font-bold">
              <span className="font-mono text-xs uppercase tracking-[0.2em]">Your status</span>
              <span className="font-display text-2xl uppercase">{status.title}</span>
            </p>
            <p className="text-sm">{status.body}</p>
          </Container>
        </div>
      )}

      <Container className="grid gap-10 py-12 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <div className="flex min-w-0 flex-col gap-10">
          <section aria-labelledby="brief" className="flex flex-col gap-3">
            <h2 id="brief" className="font-display text-3xl uppercase">
              The brief
            </h2>
            <Text className="whitespace-pre-line break-words text-lg">{t.description}</Text>
          </section>

          <section aria-labelledby="requirements" className="flex flex-col gap-3">
            <h2 id="requirements" className="font-display text-3xl uppercase">
              What to submit
            </h2>
            <ul className="flex list-none flex-col border-[3px] border-ink bg-surface">
              <li className="flex gap-3 border-b border-ink/20 p-4">
                <span aria-hidden="true" className="font-display text-xl text-mint">01</span>
                <span className="whitespace-pre-line break-words">
                  {t.requirements ?? "A note, a link or a file showing you completed the challenge."}
                </span>
              </li>
              <li className="flex gap-3 border-b border-ink/20 p-4">
                <span aria-hidden="true" className="font-display text-xl text-mint">02</span>
                <span>
                  {t.evidence_required
                    ? "An evidence file is required (PNG, JPEG, WebP or PDF, up to 5 MB). Only you and the organizers can view it."
                    : "An evidence file is optional. Only you and the organizers can view it."}
                </span>
              </li>
              <li className="flex gap-3 p-4">
                <span aria-hidden="true" className="font-display text-xl text-mint">03</span>
                <span>
                  {t.deadline ? `Submit before ${formatDeadline(t.deadline)}.` : "There is no deadline for this challenge."}
                </span>
              </li>
            </ul>
          </section>

          <section aria-labelledby="history" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="history" className="font-display text-3xl uppercase">
                Your attempts
              </h2>
              {latest && <SubmissionStatusBadge status={latest.status} />}
            </div>
            {submissions.data.length > 0 ? (
              <SubmissionList submissions={submissions.data} />
            ) : (
              <Text className="text-subtle">You haven&apos;t attempted this challenge yet.</Text>
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
