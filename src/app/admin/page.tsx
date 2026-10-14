import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, type CardTone } from "@/components/ui/card";
import { H1 } from "@/components/ui/typography";
import { getDashboardStats } from "@/lib/admin/data";
import { formatDeadline, relativeTime } from "@/lib/tasks/deadline";

export const metadata: Metadata = { title: "Overview" };

export default function AdminOverviewPage() {
  return (
    <Container className="flex flex-col gap-8 py-10">
      <H1 className="text-3xl sm:text-4xl">Overview</H1>
      <Suspense fallback={<PageLoading />}>
        <Stats />
      </Suspense>
    </Container>
  );
}

function Stat({ label, value, tone = "surface", href }: { label: string; value: string; tone?: CardTone; href?: string }) {
  const body = (
    <Card tone={tone} interactive={!!href} className="h-full">
      <CardBody className="flex flex-col gap-1 p-4">
        <p className="font-mono text-xs font-bold uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold">{value}</p>
      </CardBody>
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

async function Stats() {
  const result = await getDashboardStats();
  if (!result.ok) {
    return (
      <Alert tone={result.schemaMissing ? "warning" : "danger"} title="Statistics unavailable">
        {result.schemaMissing
          ? "The database is missing the admin functions. Apply migration 5 (see the README)."
          : "We couldn't load statistics. Please refresh the page."}
      </Alert>
    );
  }
  const s = result.data;
  const n = (v: number) => Number(v).toLocaleString("en");

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="queue" className="flex flex-col gap-3">
        <h2 id="queue" className="text-lg font-bold uppercase tracking-wide">
          Review queue
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Pending" value={n(s.submissions_pending)} tone="sun" href="/admin/submissions" />
          <Stat label="Reviewed (7 days)" value={n(s.reviews_7d)} />
          <Stat
            label="Oldest pending"
            value={s.oldest_pending_at ? relativeTime(s.oldest_pending_at, new Date()) : "—"}
          />
        </div>
        {s.oldest_pending_at && (
          <p className="font-mono text-xs text-subtle">Oldest pending since {formatDeadline(s.oldest_pending_at)}</p>
        )}
      </section>

      <section aria-labelledby="content" className="flex flex-col gap-3">
        <h2 id="content" className="text-lg font-bold uppercase tracking-wide">
          Tasks &amp; submissions
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Active tasks" value={n(s.tasks_active)} tone="mint" href="/admin/tasks" />
          <Stat label="Drafts" value={n(s.tasks_draft)} href="/admin/tasks" />
          <Stat label="Archived" value={n(s.tasks_archived)} href="/admin/tasks" />
          <Stat label="Approved" value={n(s.submissions_approved)} />
          <Stat label="Rejected" value={n(s.submissions_rejected)} />
          <Stat label="Admins" value={n(s.admins_total)} href="/admin/users" />
        </div>
      </section>

      <section aria-labelledby="people" className="flex flex-col gap-3">
        <h2 id="people" className="text-lg font-bold uppercase tracking-wide">
          Users &amp; coins
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Users" value={n(s.users_total)} href="/admin/users" />
          <Stat label="New (7 days)" value={n(s.users_new_7d)} />
          <Stat label="Coins rewarded" value={n(s.coins_rewarded)} tone="mint" />
          <Stat label="In circulation" value={n(s.coins_in_circulation)} />
        </div>
        <p className="text-sm text-subtle">
          Manual adjustments total {n(s.coins_adjusted)} coins. All figures are computed from the database on each
          visit.
        </p>
      </section>
    </div>
  );
}
