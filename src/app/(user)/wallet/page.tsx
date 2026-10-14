import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CoinSummaryCards } from "@/components/coins/coin-summary-cards";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { getMyCoinSummary, listMyTransactions } from "@/lib/coins/data";
import { describeTransaction, formatAmount } from "@/lib/coins/ledger";
import { formatDeadline } from "@/lib/tasks/deadline";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage({ searchParams }: PageProps<"/wallet">) {
  return (
    <>
      <PageHeader
        eyebrow="Wallet"
        title="Your coins"
        description="Every coin comes from a recorded transaction. Coins are virtual points with no cash value."
      />
      <Suspense fallback={<PageLoading />}>
        <Wallet searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Wallet({ searchParams }: Pick<PageProps<"/wallet">, "searchParams">) {
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const [summary, ledger] = await Promise.all([getMyCoinSummary("/wallet"), listMyTransactions(page)]);

  if (!summary.ok || !ledger.ok) {
    const schemaMissing = (!summary.ok && summary.schemaMissing) || (!ledger.ok && ledger.schemaMissing);
    return (
      <Container className="py-12">
        <Alert tone={schemaMissing ? "warning" : "danger"} title="Wallet unavailable">
          {schemaMissing
            ? "The database is missing the latest coin changes. Apply migration 6 (see the README)."
            : "We couldn't load your coins. Please refresh the page."}
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="flex flex-col gap-10 py-12">
      <CoinSummaryCards summary={summary.data} />

      <section aria-labelledby="history" className="flex flex-col gap-4">
        <h2 id="history" className="text-xl font-bold uppercase tracking-wide">
          Transaction history
        </h2>
        {ledger.data.rows.length === 0 ? (
          <Alert tone="info">
            No transactions yet.{" "}
            <Link href="/tasks" className="font-bold underline">
              Complete a task
            </Link>{" "}
            to earn your first coins.
          </Alert>
        ) : (
          <ol className="flex list-none flex-col border-[3px] border-ink bg-surface shadow-brutal">
            {ledger.data.rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/20 p-4 last:border-0"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="break-words font-bold">{describeTransaction(row)}</p>
                  <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-subtle">
                    <Badge tone={row.kind === "task_reward" ? "mint" : "sky"}>
                      {row.kind === "task_reward" ? "Reward" : "Adjustment"}
                    </Badge>
                    {formatDeadline(row.created_at)}
                  </p>
                </div>
                <p className="font-mono text-xl font-bold">
                  {formatAmount(row.amount)}
                </p>
              </li>
            ))}
          </ol>
        )}
        {(page > 1 || ledger.data.hasMore) && (
          <nav aria-label="Pages" className="flex gap-3">
            {page > 1 && (
              <Link href={`/wallet?page=${page - 1}`} className={buttonStyles({ size: "sm", variant: "secondary" })}>
                ← Newer
              </Link>
            )}
            {ledger.data.hasMore && (
              <Link href={`/wallet?page=${page + 1}`} className={buttonStyles({ size: "sm", variant: "secondary" })}>
                Older →
              </Link>
            )}
          </nav>
        )}
      </section>

      <section aria-labelledby="rules" className="flex flex-col gap-2 text-sm">
        <h2 id="rules" className="font-bold uppercase tracking-wide">
          How coins work
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-subtle">
          <li>You earn a task&apos;s reward once, when an admin approves your submission.</li>
          <li>Admins can add coins or correct mistakes; every adjustment has a recorded reason.</li>
          <li>
            <strong>Balance</strong> is all your transactions added up. <strong>Lifetime earned</strong> counts only
            earnings, so it would not go down if coins were ever spent.
          </li>
          <li>The leaderboard ranks public profiles by lifetime earnings.</li>
        </ul>
      </section>
    </Container>
  );
}
