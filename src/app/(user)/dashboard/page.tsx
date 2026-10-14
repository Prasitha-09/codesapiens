import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { CoinSummaryCards } from "@/components/coins/coin-summary-cards";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { getMyCoinSummary } from "@/lib/coins/data";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader eyebrow="Dashboard" title="Your dashboard" description="Your account, balance and progress." />
      <Suspense fallback={<PageLoading />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

async function DashboardContent() {
  const user = await requireUser("/dashboard");
  const [result, coins] = await Promise.all([getCurrentProfile(), getMyCoinSummary("/dashboard")]);
  const profile = result?.status === "ok" ? result.profile : null;

  return (
    <>
      <Container className="flex flex-col gap-6 pt-12">
        {result?.status === "schema-missing" && (
          <Alert tone="warning" title="Database not set up yet">
            You&apos;re signed in, but the <code className="font-mono">profiles</code> table doesn&apos;t exist. Run{" "}
            <code className="font-mono">supabase/migrations/20261014000001_profiles_and_roles.sql</code> in the Supabase
            SQL Editor.
          </Alert>
        )}
        {result?.status === "missing" && (
          <Alert tone="warning" title="Profile not found">
            Your account has no profile row. This happens for accounts created before the migration ran — see the README
            for the one-line fix.
          </Alert>
        )}
        {result?.status === "error" && (
          <Alert tone="danger" title="Couldn't load your profile">
            Please refresh the page. If this keeps happening, check the server logs.
          </Alert>
        )}

        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
              <dt className="font-bold uppercase tracking-wide">Username</dt>
              <dd className="truncate font-mono">{profile ? `@${profile.username}` : "—"}</dd>
              <dt className="font-bold uppercase tracking-wide">Email</dt>
              <dd className="truncate font-mono">{user.email ?? "—"}</dd>
              <dt className="font-bold uppercase tracking-wide">Role</dt>
              <dd>
                {profile ? (
                  <Badge tone={profile.role === "admin" ? "ink" : "mint"}>{profile.role}</Badge>
                ) : (
                  "—"
                )}
              </dd>
            </dl>
          </CardBody>
        </Card>
      </Container>
      <Container className="flex flex-col gap-4 py-12">
        <h2 className="text-xl font-bold uppercase tracking-wide">Your coins</h2>
        {coins.ok ? (
          <CoinSummaryCards summary={coins.data} />
        ) : (
          <Alert tone={coins.schemaMissing ? "warning" : "danger"} title="Coins unavailable">
            {coins.schemaMissing
              ? "The database is missing the latest coin changes. Apply migration 6 (see the README)."
              : "We couldn't load your coins. Please refresh the page."}
          </Alert>
        )}
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/wallet" variant="secondary">
            Transaction history
          </ButtonLink>
          <ButtonLink href="/tasks">Find tasks</ButtonLink>
          <ButtonLink href="/submissions" variant="secondary">
            My submissions
          </ButtonLink>
        </div>
      </Container>
    </>
  );
}
