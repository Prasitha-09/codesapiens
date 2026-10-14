import Link from "next/link";
import { Card, CardBody, type CardTone } from "@/components/ui/card";
import type { CoinSummary } from "@/lib/coins/data";

function Stat({ label, value, hint, tone = "surface" }: { label: string; value: string; hint?: string; tone?: CardTone }) {
  return (
    <Card tone={tone} className="h-full">
      <CardBody className="flex flex-col gap-1 p-4">
        <p className="font-mono text-xs font-bold uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold">{value}</p>
        {hint && <p className="text-xs">{hint}</p>}
      </CardBody>
    </Card>
  );
}

export function CoinSummaryCards({ summary }: { summary: CoinSummary }) {
  const n = (v: number) => v.toLocaleString("en");
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat label="Balance" value={n(summary.balance)} hint="Spendable coins" tone="mint" />
      <Stat label="Lifetime earned" value={n(summary.lifetime_earned)} hint="Never reduced by spending" tone="sun" />
      <Stat label="Tasks rewarded" value={n(summary.rewards_count)} />
      <Card className="h-full">
        <CardBody className="flex flex-col gap-1 p-4">
          <p className="font-mono text-xs font-bold uppercase tracking-wider">Leaderboard</p>
          <p className="text-3xl font-bold">{summary.leaderboard_rank ? `#${summary.leaderboard_rank}` : "—"}</p>
          <p className="text-xs">
            {summary.leaderboard_rank ? (
              <Link href="/leaderboard" className="underline">
                View leaderboard
              </Link>
            ) : !summary.is_public ? (
              "Hidden: your profile is private"
            ) : (
              "Earn coins to get ranked"
            )}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
