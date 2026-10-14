// Checks, through the real Supabase API, what an ANONYMOUS visitor can and can't do.
// Uses only the public URL + publishable key from .env.local — no secrets, no
// accounts, no emails, and it writes nothing.
//
//   npm run test:api
//
// Role-based rules (user vs admin) are covered by supabase/tests/permissions_test.sql.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
        .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
    );
  } catch {
    return {};
  }
}

const env = { ...loadEnv(".env.local"), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok, detail });

// Anonymous visitors must be refused (42501), not merely shown zero rows.
for (const table of ["profiles", "tasks", "task_submissions", "coin_transactions", "audit_logs", "coin_balances"]) {
  const { data, error } = await supabase.from(table).select("*").limit(1);
  record(`Anon cannot read ${table}`, error?.code === "42501", error ? `${error.code} ${error.message}` : `read ${data.length} rows`);
}

for (const [name, args] of [
  ["review_submission", { p_submission_id: "00000000-0000-0000-0000-000000000000", p_decision: "approved" }],
  ["admin_adjust_coins", { p_user_id: "00000000-0000-0000-0000-000000000000", p_amount: 100, p_reason: "test" }],
  ["set_user_role", { p_user_id: "00000000-0000-0000-0000-000000000000", p_role: "admin" }],
  ["regenerate_public_slug", {}],
  ["admin_list_users", { p_search: null, p_limit: 10, p_offset: 0 }],
  ["admin_dashboard_stats", {}],
  ["get_my_coin_summary", {}],
]) {
  const { error } = await supabase.rpc(name, args);
  record(`Anon cannot call ${name}`, error?.code === "42501", error ? `${error.code} ${error.message}` : "call succeeded");
}

{
  const { error } = await supabase.from("coin_transactions").insert({ user_id: "00000000-0000-0000-0000-000000000000", amount: 1, kind: "admin_adjustment", reason: "x" });
  record("Anon cannot insert coin transactions", error?.code === "42501", error ? `${error.code} ${error.message}` : "insert succeeded");
}

{
  const { data, error } = await supabase.rpc("get_leaderboard", { p_limit: 5 });
  const allowed = ["leaderboard_rank", "username", "display_name", "avatar_url", "public_slug", "lifetime_coins", "approved_tasks"].sort().join(",");
  const keysOk = !error && (data ?? []).every((row) => Object.keys(row).sort().join(",") === allowed);
  record("Anon can read leaderboard (allow-listed fields only)", keysOk, error ? `${error.code} ${error.message}` : `${data.length} rows`);
}

{
  const { data, error } = await supabase.rpc("get_public_profile", { p_slug: "000000000000" });
  record("Unknown public slug returns nothing", !error && data.length === 0, error ? `${error.code} ${error.message}` : `${data.length} rows`);
}

{
  const path = `00000000-0000-0000-0000-000000000000/${crypto.randomUUID()}.png`;
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const { data, error } = await supabase.storage.from("submission-evidence").upload(path, png, { contentType: "image/png" });
  record("Anon cannot upload evidence files", !data && !!error, error ? error.message : "upload succeeded");
}

{
  const { data, error } = await supabase.storage.from("submission-evidence").list("", { limit: 10 });
  record("Anon cannot list evidence files", !!error || (data ?? []).length === 0, error ? error.message : `${data.length} entries`);
}

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `\n      ↳ ${r.detail}`}`);
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed} of ${results.length} anonymous API checks passed`);
process.exit(passed === results.length ? 0 : 1);
