# Code Sapiens — database security

How the database enforces The Challenge Arena's rules, how to apply the migrations, and how to test permissions.

## Principles

1. **The database is the authority.** Every rule below holds even if someone calls the Supabase API directly with their own session, bypassing the app.
2. **Least privilege.** Supabase grants all privileges on new tables to `anon`/`authenticated` by default. Each migration **revokes everything** and grants back only specific columns. RLS then filters rows.
3. **Sensitive changes happen only inside functions.** Roles, submission status, coin rows and audit rows have no client write privileges at all. They change only inside `SECURITY DEFINER` functions. Each function:
   - sets `search_path = ''`,
   - schema-qualifies every object,
   - checks `is_admin()` and ownership before doing anything.
4. **Roles come from `profiles.role`**, never from JWT `user_metadata`, which users can edit themselves.
5. **No service-role key** anywhere in the app.

## Access matrix

| Object | Anonymous | Signed-in user | Admin |
|---|---|---|---|
| `profiles` | ✗ | Read own row; update own `username`, `display_name`, `avatar_url`, `bio`, `is_public`, `social_links` (validated by `valid_social_links()` CHECK). `public_slug` only via `regenerate_public_slug()` | Read all; change roles **only** via `set_user_role()` |
| `tasks` | ✗ | Read `active` tasks | Read all; insert/update via RLS (audited by trigger); no delete |
| `task_submissions` | ✗ | Insert own (`task_id` + proof only) to active, unexpired tasks; read own; edit proof while `pending` | Read all; review **only** via `review_submission()` |
| `coin_transactions` | ✗ | Read own | Read all; write **only** via `review_submission()` / `admin_adjust_coins()` |
| `coin_balances` (view, `security_invoker`) | ✗ | Own balance | All balances |
| `audit_logs` | ✗ | ✗ (0 rows) | Read all |
| `get_public_profile(slug)` | ✓ allow-listed fields | ✓ | ✓ |
| `get_leaderboard(limit)` | ✓ allow-listed fields | ✓ | ✓ |

Nobody, admins included, can update or truncate ledger or audit rows; a trigger blocks it for every role. The one exception: when an admin account is deleted, the actor column is set to `NULL` automatically and the history is kept.

## Privileged functions: review

| Function | Who can call it | Checks | Writes |
|---|---|---|---|
| `is_admin()` | authenticated | Reads the caller's own role | — |
| `review_submission(id, decision, note)` | authenticated; **must be admin** | admin; decision ≠ pending; note ≤ 1000 chars; **rejection requires a reason (≥ 3 chars)**; row locked `FOR UPDATE`; not own submission; still `pending` | Submission status/review fields; on approval, **one** ledger row (amount taken from the task, never from the caller); audit row |
| `admin_adjust_coins(user, amount, reason)` | authenticated; **must be admin** | admin; not own balance; amount ≠ 0 and ≤ 100000 in size; reason 3–500 chars; target row locked; result ≥ 0 | Ledger row; audit row |
| `set_user_role(user, role)` | authenticated; **must be admin** | admin; not own role (so at least one admin always remains); target exists | `profiles.role`; audit row |
| `regenerate_public_slug()` | authenticated | Signed in | Caller's own `public_slug` |
| `storage.objects` (bucket `submission-evidence`, private) | ✗ | Upload into own folder `<user_id>/`; read own files; delete only own files not attached to a submission; never overwrite | Read all evidence (for review) |
| `admin_list_users(search, limit, offset)` | authenticated; **must be admin** | admin; search ≤ 100 chars, LIKE wildcards escaped; limit 1–100 | — (returns users incl. email from `auth.users`) |
| `admin_dashboard_stats()` | authenticated; **must be admin** | admin | — (counts/sums from stored rows) |
| `get_public_profile(slug)` | anon, authenticated | Slug format; `is_public` | — (returns 9 allow-listed fields incl. `social_links`) |
| `get_leaderboard(limit)` | anon, authenticated | `is_public`; balance > 0; limit clamped to 1–100 | — (returns 6 allow-listed fields) |
| `handle_new_user()` (trigger) | not callable | Validates the requested username; **always** assigns role `user` | Profile row |
| `audit_task_change()` (trigger) | not callable | — | Audit row |

### Why duplicate rewards are impossible

1. `review_submission` locks the submission row (`SELECT … FOR UPDATE`). A concurrent approval waits, then sees `status <> 'pending'` and fails.
2. The status update and the ledger insert happen in **one transaction**. If either fails, both roll back.
3. `coin_transactions.submission_id` is **UNIQUE**. Even a privileged role can't insert a second reward for the same submission.
4. Clients have no INSERT privilege on the ledger and no UPDATE privilege on `status`.
5. A partial unique index allows at most one pending or approved submission per user per task.

## Coin transaction rules (migration 6)

| # | Rule | Enforced by |
|---|---|---|
| R1 | The ledger is the only source of truth; rows are append-only | No client write grants; UPDATE/TRUNCATE trigger |
| R2 | **Balance** = sum of all of a user's ledger rows | `coin_balances` view, `get_my_coin_summary()` |
| R3 | **Lifetime earnings** = sum of *earning* rows only (`task_reward`, `admin_adjustment`). A future spending kind must not be in this set, so spending would never lower lifetime earnings | View/functions filter by kind; unit test simulates a spend |
| R4 | A reward requires an **approved** submission by the **same user**, for **exactly** the task's configured reward; one per submission | `enforce_coin_ledger_rules` trigger (all roles) + UNIQUE |
| R5 | A balance can never go negative; writes for one user are serialized | Same trigger locks the user's profile row |
| R6 | Only `review_submission()` pays rewards; only `admin_adjust_coins()` adjusts | Admin checks in both functions; no client grants |
| R7 | Leaderboard = public profiles ranked by lifetime earnings (> 0), ties share a rank, computed live | `get_leaderboard()` |

Spending coins is not part of the approved plan and is not implemented.

## Applying the migrations (development project first)

1. Use a **development** Supabase project, not production.
2. Open the dashboard and go to **SQL Editor → New query**.
3. Run each file in `supabase/migrations/` **once**, in filename order:
   - `20261014000001_profiles_and_roles.sql` (already applied to the current dev project)
   - `20261014000002_tasks_submissions_coins.sql` (applied)
   - `20261014000003_profile_social_links.sql` (applied)
   - `20261014000004_task_evidence.sql` (applied)
   - `20261014000005_admin_dashboard.sql` (applied)
   - `20261014000006_coins_leaderboard.sql`
   - Optional, dev only: `supabase/seed/dev_tasks.sql` (sample tasks)
4. Paste the whole file, then click **Run**. The editor runs it as a single transaction, so if it errors nothing from that run is kept. Fix the problem and re-run.
5. Don't edit a migration after it has been applied anywhere. Add a new migration instead.

## Testing permissions

| Test | Command / where | What it covers | Notes |
|---|---|---|---|
| Local database tests | `npm run test:db` | Applies all migrations to an in-memory Postgres (PGlite) with a Supabase stub, then runs the full permission suite | Fast, no network; stub only approximates Supabase |
| **Real-project permission suite** | Paste `supabase/tests/permissions_test.sql` into the SQL Editor of the **dev** project and run it | 114 checks as anon, users and admins (incl. evidence storage, deadlines, admin functions, coin rules and rankings), against the real database | **Rolls back everything it creates.** First row shows `SUMMARY: N of N tests passed` |
| Anonymous API checks | `npm run test:api` | What an anonymous visitor can do through the real REST API | Uses only the publishable key; writes nothing |

Security should be considered verified for an environment only after the SQL suite **and** `npm run test:api` both pass there.

### Not covered by automated tests (yet)

- ~~Truly concurrent double-approval~~ — now covered by `npm run test:concurrency` (real PostgreSQL, separate connections).
- **Signed-in API calls through PostgREST.** These need real test accounts. The SQL suite impersonates the same roles and claims that PostgREST uses.

## Known limitations and accepted risks

- An admin could collude with a user, for example by approving weak work or making a large adjustment. Mitigations: admins can't reward themselves, and every action is in the append-only audit log.
- Leaderboard and balances sum the ledger on every read. That's fine at small scale; add a cached balance later if needed.
- Users can change their username at any time. Uniqueness and format are enforced.
- `tasks.created_by` (an admin's user id) is visible to signed-in users. It's low sensitivity.
