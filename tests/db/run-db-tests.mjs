// Applies every migration in supabase/migrations to a fresh in-memory Postgres
// (PGlite) with a minimal Supabase stub, then runs supabase/tests/permissions_test.sql.
//
//   npm run test:db
//
// Exits non-zero if any migration fails or any permission test fails.
// Limitations: single connection (no concurrency tests) and only a stub of
// Supabase's auth schema — always also run the SQL test in a real dev project.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationsDir = path.join(root, "supabase", "migrations");

const db = new PGlite();

async function execFile(label, file) {
  const sql = await readFile(file, "utf8");
  try {
    return await db.exec(sql);
  } catch (error) {
    console.error(`✗ ${label} failed: ${error.message}`);
    process.exit(1);
  }
}

await execFile("Supabase stub", path.join(root, "tests", "db", "supabase-stub.sql"));
console.log("✓ Supabase stub");

const migrations = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
for (const file of migrations) {
  await execFile(file, path.join(migrationsDir, file));
  console.log(`✓ migration ${file}`);
}

const results = await execFile("permissions_test.sql", path.join(root, "supabase", "tests", "permissions_test.sql"));
const rows = results.at(-1)?.rows ?? [];
if (rows.length === 0) {
  console.error("✗ Test script returned no rows");
  process.exit(1);
}

console.log("");
for (const row of rows) {
  const mark = row.passed ? "PASS" : "FAIL";
  const line = `${String(row.test_no).padStart(2)} ${mark}  ${row.test}`;
  console.log(row.passed ? line : `${line}\n         ↳ ${row.detail}`);
}

await db.close();
process.exit(rows.every((r) => r.passed) ? 0 : 1);
