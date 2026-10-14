// The optional development seed must run cleanly against the real migrations,
// be idempotent, and produce tasks that the database's own rules treat
// correctly (e.g. the expired example task rejects submissions).

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
let db: PGlite;
let seed: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile(path.join(root, "tests/db/supabase-stub.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(await readFile(path.join(dir, file), "utf8"));
  }
  seed = await readFile(path.join(root, "supabase/seed/dev_tasks.sql"), "utf8");
});

afterAll(async () => {
  await db?.close();
});

describe("dev task seed", () => {
  it("inserts the sample tasks and is safe to run twice", async () => {
    await db.exec(seed);
    await db.exec(seed);
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.tasks");
    expect(rows[0].n).toBe(4);
  });

  it("the expired example task rejects submissions (deadline enforced by RLS)", async () => {
    const userId = crypto.randomUUID();
    await db.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{}'::jsonb)",
      [userId, `seed-${userId}@taskmint.test`],
    );
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
    try {
      await expect(
        db.query(
          "insert into public.task_submissions (task_id, proof_text) select id, 'late' from public.tasks where title = 'Expired example task'",
        ),
      ).rejects.toMatchObject({ code: "42501" });

      const ok = await db.query<{ id: string }>(
        "insert into public.task_submissions (task_id, proof_text) select id, 'done' from public.tasks where title = 'Share TaskMint with a friend' returning id",
      );
      expect(ok.rows).toHaveLength(1);
    } finally {
      await db.exec("reset role");
    }
  });
});
