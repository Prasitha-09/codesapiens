// Ledger rules R2/R3/R5 on the real migrations (PGlite).
//
// Spending is NOT a TaskMint feature. To prove the rule "spending must never
// reduce lifetime earnings" holds for any future spending kind, this test adds
// a TEST-ONLY kind to a throwaway in-memory database and checks that a spend
// lowers the balance but not lifetime earnings or leaderboard standing.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
let db: PGlite;
const admin = crypto.randomUUID();
const user = crypto.randomUUID();
const username = `spend_${user.slice(0, 8)}`;

async function asUser<T>(sub: string, fn: () => Promise<T>): Promise<T> {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub, role: "authenticated" })]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', '', false)");
  }
}

async function summary() {
  return asUser(user, async () => {
    const { rows } = await db.query<{ balance: number; lifetime_earned: number }>(
      "select balance::int, lifetime_earned::int from public.get_my_coin_summary()",
    );
    return rows[0];
  });
}

async function boardLifetime() {
  const { rows } = await db.query<{ lifetime_coins: number }>(
    "select lifetime_coins::int from public.get_leaderboard(100) where username = $1",
    [username],
  );
  return rows[0]?.lifetime_coins ?? null;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile(path.join(root, "tests/db/supabase-stub.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const f of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(await readFile(path.join(dir, f), "utf8"));
  }

  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3), ($4, $5, $6)", [
    admin, `${admin}@taskmint.test`, { username: `adm_${admin.slice(0, 8)}` },
    user, `${user}@taskmint.test`, { username },
  ]);
  await db.query("update public.profiles set role = 'admin' where id = $1", [admin]);
  const { rows: [task] } = await db.query<{ id: string }>(
    "insert into public.tasks (title, description, reward_coins, status) values ('Spend test', 'x', 50, 'active') returning id",
  );
  const { rows: [sub] } = await db.query<{ id: string }>(
    "insert into public.task_submissions (task_id, user_id, proof_text) values ($1, $2, 'done') returning id",
    [task.id, user],
  );
  await asUser(admin, () => db.query("select public.review_submission($1, 'approved')", [sub.id]));
});

afterAll(async () => {
  await db?.close();
});

describe("balance vs lifetime earnings", () => {
  it("an approved reward raises both balance and lifetime earnings", async () => {
    expect(await summary()).toEqual({ balance: 50, lifetime_earned: 50 });
    expect(await boardLifetime()).toBe(50);
  });

  it("an admin correction (an earning adjustment) lowers both", async () => {
    await asUser(admin, () => db.query("select public.admin_adjust_coins($1, -10, 'Correction')", [user]));
    expect(await summary()).toEqual({ balance: 40, lifetime_earned: 40 });
  });

  it("a (test-only) spend lowers the balance but NOT lifetime earnings or rank", async () => {
    // Simulate a future spending feature in this throwaway database only.
    await db.exec("alter type public.coin_tx_kind add value 'test_spend'");
    await db.exec(`
      alter table public.coin_transactions drop constraint coin_transactions_kind_shape;
      alter table public.coin_transactions add constraint coin_transactions_kind_shape check (
        (kind = 'task_reward' and submission_id is not null and amount > 0)
        or (kind = 'admin_adjustment' and submission_id is null and reason is not null)
        or (kind = 'test_spend' and submission_id is null and amount < 0)
      );
    `);
    await db.query("insert into public.coin_transactions (user_id, amount, kind) values ($1, -15, 'test_spend')", [user]);

    expect(await summary()).toEqual({ balance: 25, lifetime_earned: 40 });
    expect(await boardLifetime()).toBe(40);
  });

  it("a spend can never overdraw the balance (ledger trigger)", async () => {
    await expect(
      db.query("insert into public.coin_transactions (user_id, amount, kind) values ($1, -26, 'test_spend')", [user]),
    ).rejects.toMatchObject({ code: "23514" });
    expect((await summary()).balance).toBe(25);
  });
});
