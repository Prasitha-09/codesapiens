import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { ChallengeCard } from "@/components/tasks/challenge-card";
import { SubmissionStatusBadge } from "@/components/tasks/submission-status";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/typography";
import { buildActivity, type ActivityEvent } from "@/lib/arena/activity";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { getMyCoinSummary, listMyTransactions } from "@/lib/coins/data";
import { formatAmount } from "@/lib/coins/ledger";
import { getTaskTitles, listActiveTasks, listMySubmissions } from "@/lib/tasks/data";
import { formatDeadline, isPastDeadline, relativeTime } from "@/lib/tasks/deadline";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My Arena" };

export default function MyArenaPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Arena />
    </Suspense>
  );
}

function SectionTitle({ id, eyebrow, title, action }: { id: string; eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={id} className="font-display text-3xl uppercase leading-none sm:text-4xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function Tile({ label, value, hint, tone = "surface" }: { label: string; value: string; hint?: string; tone?: "surface" | "mint" }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-[3px] border-ink p-4 shadow-brutal",
        tone === "mint" ? "bg-mint text-on-accent" : "bg-surface",
      )}
    >
      <span className="font-mono text-xs font-bold uppercase tracking-wider">{label}</span>
      <span className="font-display text-4xl leading-none">{value}</span>
      {hint && <span className={cn("text-xs", tone === "mint" ? "text-on-accent/75" : "text-subtle")}>{hint}</span>}
    </div>
  );
}

const activityStyle: Record<ActivityEvent["kind"], { label: string; className: string }> = {
  submitted: { label: "Submitted", className: "bg-surface text-ink" },
  approved: { label: "Approved", className: "bg-mint text-on-accent" },
  rejected: { label: "Rejected", className: "bg-danger text-on-accent" },
  coins: { label: "Coins", className: "bg-sun text-on-accent" },
};

async function Arena() {
  const user = await requireUser("/dashboard");
  const [profileResult, tasks, submissions, coins, ledger] = await Promise.all([
    getCurrentProfile(),
    listActiveTasks(),
    listMySubmissions(),
    getMyCoinSummary("/dashboard"),
    listMyTransactions(1),
  ]);
  const profile = profileResult?.status === "ok" ? profileResult.profile : null;
  const name = profile?.display_name ?? profile?.username ?? user.email ?? "participant";

  const subs = submissions.status === "ok" ? submissions.data : [];
  const titles = await getTaskTitles([...new Set(subs.map((s) => s.task_id))]);
  const now = new Date();

  // Latest attempt per challenge (list is newest first).
  const latest = new Map<string, (typeof subs)[number]>();
  for (const s of subs) if (!latest.has(s.task_id)) latest.set(s.task_id, s);

  const openTasks =
    tasks.status === "ok" ? tasks.data.filter((t) => !isPastDeadline(t.deadline, now)) : [];
  const available = openTasks.filter((t) => {
    const s = latest.get(t.id);
    return !s || s.status === "rejected";
  });
  const pending = subs.filter((s) => s.status === "pending");
  const completed = subs.filter((s) => s.status === "approved");
  const activity = ledger.ok ? buildActivity(subs, ledger.data.rows, titles) : buildActivity(subs, [], titles);
  const summary = coins.ok ? coins.data : null;
  const loadFailed = tasks.status !== "ok" || submissions.status !== "ok" || !coins.ok || !ledger.ok;

  return (
    <>
      {/* -------------------------------------------------- welcome */}
      <section aria-labelledby="welcome" className="relative overflow-hidden border-b-[3px] border-ink">
        <div aria-hidden="true" className="bg-lines absolute inset-0" />
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-2 bg-mint" />
        <Container className="relative flex flex-col gap-8 py-10 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex min-w-0 flex-col gap-3">
              <Eyebrow>My Arena</Eyebrow>
              <h1 id="welcome" className="font-display text-5xl uppercase leading-[0.92] sm:text-6xl lg:text-7xl">
                Welcome back,
                <br />
                <span className="break-words text-mint">{name}</span>
              </h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/tasks">Explore Challenges</ButtonLink>
              <ButtonLink href="/submissions" variant="secondary">
                My Attempts
              </ButtonLink>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile
              label="My Coins"
              value={summary ? summary.balance.toLocaleString("en") : "—"}
              hint={summary ? `${summary.lifetime_earned.toLocaleString("en")} earned in total` : undefined}
              tone="mint"
            />
            <Tile
              label="Leaderboard"
              value={summary?.leaderboard_rank ? `#${summary.leaderboard_rank}` : "—"}
              hint={
                !summary
                  ? undefined
                  : summary.leaderboard_rank
                    ? "Your current position"
                    : !summary.is_public
                      ? "Hidden — profile is private"
                      : "Earn coins to get ranked"
              }
            />
            <Tile label="Completed" value={String(completed.length)} hint="Approved challenges" />
            <Tile label="Pending" value={String(pending.length)} hint="Waiting for review" />
          </div>
        </Container>
      </section>

      <Container className="flex flex-col gap-6 py-12">
        {profileResult?.status === "schema-missing" && (
          <Alert tone="warning" title="Database not set up yet">
            The profiles table is missing. Apply the migrations listed in the README.
          </Alert>
        )}
        {profileResult?.status === "missing" && (
          <Alert tone="warning" title="Profile not found">
            Your account has no profile row yet. See the README for the one-line fix.
          </Alert>
        )}
        {loadFailed && (
          <Alert tone="danger" title="Some sections couldn't load">
            Parts of your arena are missing because the server didn&apos;t respond. Please refresh the page.
          </Alert>
        )}
      </Container>

      <Container className="grid gap-12 pb-16 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex min-w-0 flex-col gap-12">
          {/* ------------------------------------------ available */}
          <section aria-labelledby="available" className="flex flex-col gap-6">
            <SectionTitle
              id="available"
              eyebrow={`${available.length} open for you`}
              title="Available challenges"
              action={
                <Link href="/tasks" className="font-bold uppercase tracking-wide underline-offset-4 hover:underline">
                  All challenges →
                </Link>
              }
            />
            {available.length === 0 ? (
              <p className="border-[3px] border-dashed border-ink/40 p-6 text-subtle">
                {tasks.status === "ok"
                  ? "Nothing new to attempt right now — you're up to date. New challenges appear here as soon as they're published."
                  : "Challenges couldn't be loaded."}
              </p>
            ) : (
              <ul className="grid list-none gap-6 md:grid-cols-2">
                {available.slice(0, 4).map((t, i) => (
                  <li key={t.id}>
                    <ChallengeCard task={t} index={i + 1} status={latest.get(t.id)?.status} now={now} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ------------------------------------------ pending */}
          <section aria-labelledby="pending" className="flex flex-col gap-6">
            <SectionTitle id="pending" eyebrow="Waiting for review" title="Pending attempts" />
            {pending.length === 0 ? (
              <p className="text-subtle">No attempts are waiting for review.</p>
            ) : (
              <ul className="flex list-none flex-col border-[3px] border-ink bg-surface">
                {pending.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/20 p-4 last:border-0">
                    <Link href={`/tasks/${s.task_id}`} className="min-w-0 truncate font-bold hover:underline">
                      {titles.get(s.task_id)?.title ?? "Challenge"}
                    </Link>
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-xs text-subtle">submitted {relativeTime(s.created_at, now)}</span>
                      <SubmissionStatusBadge status="pending" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ------------------------------------------ completed */}
          <section aria-labelledby="completed" className="flex flex-col gap-6">
            <SectionTitle id="completed" eyebrow="Approved" title="Completed challenges" />
            {completed.length === 0 ? (
              <p className="text-subtle">Your approved challenges will be listed here.</p>
            ) : (
              <ul className="grid list-none gap-3 sm:grid-cols-2">
                {completed.map((s) => {
                  const t = titles.get(s.task_id);
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/tasks/${s.task_id}`}
                        className="flex items-center justify-between gap-3 border-[3px] border-ink bg-surface p-4 hover:bg-muted"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center border-2 border-ink bg-mint font-bold text-on-accent">
                            ✓
                          </span>
                          <span className="truncate font-bold">{t?.title ?? "Challenge"}</span>
                        </span>
                        {s.reviewed_at && <span className="shrink-0 font-mono text-xs text-subtle">{relativeTime(s.reviewed_at, now)}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* ------------------------------------------ sidebar */}
        <aside className="flex flex-col gap-8">
          <section aria-labelledby="coins-side" className="flex flex-col gap-4 border-[3px] border-ink bg-surface p-6 shadow-brutal">
            <h2 id="coins-side" className="font-display text-3xl uppercase leading-none">
              My Coins
            </h2>
            {summary ? (
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="font-mono text-xs uppercase text-subtle">Balance</dt>
                  <dd className="font-display text-4xl text-mint">{summary.balance.toLocaleString("en")}</dd>
                </div>
                <div>
                  <dt className="font-mono text-xs uppercase text-subtle">Earned</dt>
                  <dd className="font-display text-4xl">{summary.lifetime_earned.toLocaleString("en")}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-subtle">Coins couldn&apos;t be loaded.</p>
            )}
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/wallet" size="sm" variant="secondary">
                History
              </ButtonLink>
              <ButtonLink href="/leaderboard" size="sm" variant="secondary">
                Leaderboard
              </ButtonLink>
            </div>
          </section>

          <section aria-labelledby="activity" className="flex flex-col gap-4">
            <h2 id="activity" className="font-display text-3xl uppercase leading-none">
              Recent activity
            </h2>
            {activity.length === 0 ? (
              <p className="text-subtle">Your submissions, reviews and coins will show up here.</p>
            ) : (
              <ol className="flex list-none flex-col border-l-[3px] border-ink">
                {activity.map((e) => {
                  const style = activityStyle[e.kind];
                  return (
                    <li key={e.id} className="relative flex flex-col gap-1 pb-5 pl-5 last:pb-0">
                      <span aria-hidden="true" className="absolute -left-[9px] top-1 size-4 border-[3px] border-ink bg-paper" />
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={cn("border-2 border-ink px-1.5 font-mono text-[0.65rem] font-bold uppercase", style.className)}>
                          {style.label}
                        </span>
                        <time dateTime={e.at} title={formatDeadline(e.at)} className="font-mono text-xs text-subtle">
                          {relativeTime(e.at, now)}
                        </time>
                        {e.amount !== null && <span className="font-mono text-sm font-bold">{formatAmount(e.amount)}</span>}
                      </span>
                      {e.href ? (
                        <Link href={e.href} className="font-bold leading-snug hover:underline">
                          {e.title}
                        </Link>
                      ) : (
                        <span className="font-bold leading-snug">{e.title}</span>
                      )}
                      {e.detail && <span className="text-sm text-subtle">“{e.detail}”</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </aside>
      </Container>
    </>
  );
}
