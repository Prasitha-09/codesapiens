import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EARNING_KINDS, describeTransaction, formatAmount } from "@/lib/coins/ledger";

describe("ledger display helpers", () => {
  it("labels rewards with the task title", () => {
    expect(describeTransaction({ kind: "task_reward", amount: 40, reason: null, task_title: "Write a review" })).toBe(
      "Reward: Write a review",
    );
    expect(describeTransaction({ kind: "task_reward", amount: 40, reason: null, task_title: null })).toBe("Task reward");
  });

  it("labels admin credits and corrections with their reason", () => {
    expect(describeTransaction({ kind: "admin_adjustment", amount: 10, reason: "Bonus", task_title: null })).toBe(
      "Admin credit: Bonus",
    );
    expect(describeTransaction({ kind: "admin_adjustment", amount: -5, reason: "Duplicate", task_title: null })).toBe(
      "Admin correction: Duplicate",
    );
  });

  it("formats signed amounts", () => {
    expect(formatAmount(1500)).toBe("+1,500");
    expect(formatAmount(-20)).toBe("−20");
    expect(formatAmount(0)).toBe("0");
  });
});

describe("earning kinds match the database definition", () => {
  it("every lifetime-earnings expression in migration 6 uses exactly EARNING_KINDS", async () => {
    const sql = await readFile(
      path.resolve(import.meta.dirname, "../../supabase/migrations/20261014000006_coins_leaderboard.sql"),
      "utf8",
    );
    const lists = [...sql.matchAll(/kind in \(([^)]*)\)/g)].map((m) =>
      m[1].split(",").map((s) => s.trim().replace(/'/g, "")).sort(),
    );
    expect(lists.length).toBeGreaterThanOrEqual(4);
    for (const list of lists) expect(list).toEqual([...EARNING_KINDS].sort());
  });
});
