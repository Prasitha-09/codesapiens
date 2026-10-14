import type { CoinTxKind } from "@/types/database";

/**
 * Display helpers for ledger rows. The amounts themselves always come from the
 * database; these functions never compute balances.
 *
 * Rules (mirrors migration 6):
 *   balance          = sum of all rows
 *   lifetime earned  = sum of EARNING rows (task_reward, admin_adjustment)
 * Spending isn't part of TaskMint yet; if it's added, it must use a new,
 * non-earning kind so it lowers the balance but never lifetime earnings.
 */

export const EARNING_KINDS: readonly CoinTxKind[] = ["task_reward", "admin_adjustment"];

export type LedgerRow = {
  id: number;
  amount: number;
  kind: CoinTxKind;
  reason: string | null;
  created_at: string;
  task_title: string | null;
};

export function describeTransaction(row: Pick<LedgerRow, "kind" | "amount" | "reason" | "task_title">): string {
  if (row.kind === "task_reward") {
    return row.task_title ? `Reward: ${row.task_title}` : "Task reward";
  }
  const label = row.amount >= 0 ? "Admin credit" : "Admin correction";
  return row.reason ? `${label}: ${row.reason}` : label;
}

export function formatAmount(amount: number): string {
  const n = Number(amount);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en")}`;
}
