// Real concurrency tests for submission reviews.
//
//   npm run test:concurrency
//
// Starts a temporary, real PostgreSQL server (embedded-postgres), applies the
// Supabase stub + all migrations, then fires competing review_submission()
// calls from SEPARATE connections at the same time. PGlite (used by test:db)
// has a single connection, so it can't exercise row locks — this can.
//
// Asserts that for every race exactly one review wins, the rest fail with
// "already reviewed" (55000), and the ledger holds at most one reward.

import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

const dataDir = await mkdtemp(path.join(os.tmpdir(), "taskmint-pg-"));
const port = await freePort();
const server = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: false,
  // Match Supabase: UTF-8, locale-independent (Windows would default to WIN1252).
  initdbFlags: ["--encoding=UTF8", "--no-locale"],
  onLog: () => {},
  onError: () => {},
});

const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail });
const clients = [];

async function connect() {
  const client = new pg.Client({ host: "127.0.0.1", port, user: "postgres", password: "postgres", database: "postgres" });
  await client.connect();
  clients.push(client);
  return client;
}

/** Review as `adminId` in its own transaction; optionally hold the lock before committing. */
async function review(client, adminId, submissionId, decision, note, holdMs = 0) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: adminId, role: "authenticated" }),
    ]);
    await client.query("select public.review_submission($1, $2, $3)", [submissionId, decision, note]);
    if (holdMs) await new Promise((r) => setTimeout(r, holdMs));
    await client.query("commit");
    return { ok: true };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    return { ok: false, code: error.code, message: error.message };
  }
}

try {
  await server.initialise();
  await server.start();
  const admin = await connect();

  await admin.query(await readFile(path.join(root, "tests/db/supabase-stub.sql"), "utf8"));
  const migrations = (await readdir(path.join(root, "supabase/migrations"))).filter((f) => f.endsWith(".sql")).sort();
  for (const f of migrations) await admin.query(await readFile(path.join(root, "supabase/migrations", f), "utf8"));
  console.log(`✓ real PostgreSQL ${(await admin.query("show server_version")).rows[0].server_version} with ${migrations.length} migrations`);

  // Setup: two admins, one user, one task worth 50 coins.
  const [admin1, admin2, user] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  for (const [id, name] of [[admin1, "conc_admin1"], [admin2, "conc_admin2"], [user, "conc_user"]]) {
    await admin.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      `${name}@taskmint.test`,
      { username: name },
    ]);
  }
  await admin.query("update public.profiles set role = 'admin' where id = any($1)", [[admin1, admin2]]);
  async function newPendingSubmission() {
    // A fresh 50-coin task per race (one live submission per user per task),
    // created directly by the setup role so each race starts from a pending row.
    const { rows: [task] } = await admin.query(
      "insert into public.tasks (title, description, reward_coins, status) values ('Race task', 'x', 50, 'active') returning id",
    );
    const { rows } = await admin.query(
      "insert into public.task_submissions (task_id, user_id, proof_text) values ($1, $2, 'proof') returning id",
      [task.id, user],
    );
    return rows[0].id;
  }
  async function ledgerRows(submissionId) {
    const { rows } = await admin.query(
      "select count(*)::int as n, coalesce(sum(amount),0)::int as total from public.coin_transactions where submission_id = $1",
      [submissionId],
    );
    return rows[0];
  }
  async function finalStatus(submissionId) {
    const { rows } = await admin.query("select status from public.task_submissions where id = $1", [submissionId]);
    return rows[0].status;
  }

  // Race 1: two admins approve at the same moment; the first holds its lock for 500 ms.
  {
    const s = await newPendingSubmission();
    const [c1, c2] = [await connect(), await connect()];
    const first = review(c1, admin1, s, "approved", null, 500);
    await new Promise((r) => setTimeout(r, 100)); // make sure #1 holds the row lock
    const started = Date.now();
    const second = review(c2, admin2, s, "approved", null);
    const [r1, r2] = await Promise.all([first, second]);
    const waited = Date.now() - started;
    const ledger = await ledgerRows(s);
    record(
      "Two admins approving at once: one wins, the other waits for the lock and is refused",
      r1.ok && !r2.ok && r2.code === "55000" && waited >= 300 && ledger.n === 1 && ledger.total === 50,
      `first=${r1.ok} second=${r2.code ?? "ok"} waited=${waited}ms ledger=${ledger.n}×${ledger.total}`,
    );
  }

  // Race 2: ten simultaneous approvals (e.g. repeated clicks / retries) of one submission.
  {
    const s = await newPendingSubmission();
    const conns = await Promise.all(Array.from({ length: 10 }, () => connect()));
    const outcomes = await Promise.all(conns.map((c, i) => review(c, i % 2 ? admin1 : admin2, s, "approved", null)));
    const wins = outcomes.filter((o) => o.ok).length;
    const refusals = outcomes.filter((o) => !o.ok && o.code === "55000").length;
    const ledger = await ledgerRows(s);
    record(
      "Ten simultaneous approvals: exactly one succeeds, nine are refused, one reward",
      wins === 1 && refusals === 9 && ledger.n === 1 && ledger.total === 50,
      `wins=${wins} refused=${refusals} other=${10 - wins - refusals} ledger=${ledger.n}×${ledger.total}`,
    );
  }

  // Race 3: approve and reject at the same time — one decision, consistent ledger.
  {
    const s = await newPendingSubmission();
    const [c1, c2] = [await connect(), await connect()];
    const [a, r] = await Promise.all([
      review(c1, admin1, s, "approved", null),
      review(c2, admin2, s, "rejected", "Not enough proof"),
    ]);
    const status = await finalStatus(s);
    const ledger = await ledgerRows(s);
    const consistent = (status === "approved" && ledger.n === 1) || (status === "rejected" && ledger.n === 0);
    record(
      "Approve vs reject at once: exactly one decision, ledger matches it",
      [a.ok, r.ok].filter(Boolean).length === 1 && consistent,
      `approve=${a.ok ? "won" : a.code} reject=${r.ok ? "won" : r.code} final=${status} ledger=${ledger.n}`,
    );
  }

  // ---------------------------------------------------------- balance races
  async function balanceOf(userId) {
    const { rows } = await admin.query(
      "select coalesce(sum(amount),0)::int as balance from public.coin_transactions where user_id = $1",
      [userId],
    );
    return rows[0].balance;
  }
  async function adjust(client, adminId, userId, amount, holdMs = 0) {
    await client.query("begin");
    try {
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: adminId, role: "authenticated" }),
      ]);
      await client.query("select public.admin_adjust_coins($1, $2, 'race test')", [userId, amount]);
      if (holdMs) await new Promise((r) => setTimeout(r, holdMs));
      await client.query("commit");
      return { ok: true };
    } catch (error) {
      await client.query("rollback").catch(() => {});
      return { ok: false, code: error.code };
    }
  }
  async function rawDebit(client, userId, amount, holdMs = 0) {
    // Privileged role, bypassing admin_adjust_coins(): only the ledger trigger protects this.
    await client.query("begin");
    try {
      await client.query(
        "insert into public.coin_transactions (user_id, amount, kind, reason) values ($1, $2, 'admin_adjustment', 'raw race')",
        [userId, amount],
      );
      if (holdMs) await new Promise((r) => setTimeout(r, holdMs));
      await client.query("commit");
      return { ok: true };
    } catch (error) {
      await client.query("rollback").catch(() => {});
      return { ok: false, code: error.code };
    }
  }

  // Race 4: two admins debit 50 from a 50-coin balance at the same time.
  {
    const target = crypto.randomUUID();
    await admin.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      target,
      `race4@taskmint.test`,
      { username: "race4_user" },
    ]);
    const [c0, c1, c2] = [await connect(), await connect(), await connect()];
    await adjust(c0, admin1, target, 50);
    const first = adjust(c1, admin1, target, -50, 400);
    await new Promise((r) => setTimeout(r, 100));
    const second = adjust(c2, admin2, target, -50);
    const [r1, r2] = await Promise.all([first, second]);
    const balance = await balanceOf(target);
    record(
      "Two simultaneous debits of a 50-coin balance: one succeeds, balance never goes negative",
      r1.ok && !r2.ok && r2.code === "23514" && balance === 0,
      `first=${r1.ok} second=${r2.code ?? "ok"} final balance=${balance}`,
    );
  }

  // Race 5: same, but via direct privileged inserts — the ledger trigger alone must hold.
  {
    const target = crypto.randomUUID();
    await admin.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      target,
      `race5@taskmint.test`,
      { username: "race5_user" },
    ]);
    const [c1, c2] = [await connect(), await connect()];
    await admin.query(
      "insert into public.coin_transactions (user_id, amount, kind, reason) values ($1, 50, 'admin_adjustment', 'seed')",
      [target],
    );
    const first = rawDebit(c1, target, -30, 400);
    await new Promise((r) => setTimeout(r, 100));
    const second = rawDebit(c2, target, -30);
    const [r1, r2] = await Promise.all([first, second]);
    const balance = await balanceOf(target);
    record(
      "Two simultaneous raw debits bypassing the app: the ledger trigger keeps the balance ≥ 0",
      r1.ok && !r2.ok && r2.code === "23514" && balance === 20,
      `first=${r1.ok} second=${r2.code ?? "ok"} final balance=${balance}`,
    );
  }

  // Race 6: five different submissions by one user approved at the same time.
  {
    const target = crypto.randomUUID();
    await admin.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      target,
      `race6@taskmint.test`,
      { username: "race6_user" },
    ]);
    const subs = [];
    for (let i = 0; i < 5; i++) {
      const { rows: [t] } = await admin.query(
        "insert into public.tasks (title, description, reward_coins, status) values ('Race6', 'x', $1, 'active') returning id",
        [10 + i],
      );
      const { rows: [s] } = await admin.query(
        "insert into public.task_submissions (task_id, user_id, proof_text) values ($1, $2, 'p') returning id",
        [t.id, target],
      );
      subs.push(s.id);
    }
    const conns = await Promise.all(subs.map(() => connect()));
    const outcomes = await Promise.all(subs.map((s, i) => review(conns[i], i % 2 ? admin1 : admin2, s, "approved", null)));
    const balance = await balanceOf(target);
    const expected = 10 + 11 + 12 + 13 + 14;
    record(
      "Five approvals for one user at once: all credited, balance equals the sum of rewards",
      outcomes.every((o) => o.ok) && balance === expected,
      `succeeded=${outcomes.filter((o) => o.ok).length}/5 balance=${balance} expected=${expected}`,
    );
  }
} catch (error) {
  record("Concurrency test run", false, error.message);
} finally {
  await Promise.all(clients.map((c) => c.end().catch(() => {})));
  await server.stop().catch(() => {});
  await rm(dataDir, { recursive: true, force: true }).catch(() => {});
}

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}\n      ↳ ${r.detail}`);
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed} of ${results.length} concurrency tests passed`);
process.exit(passed === results.length && results.length > 0 ? 0 : 1);
