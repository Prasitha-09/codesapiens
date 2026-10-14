-- TaskMint · Permission & RLS test suite
--
-- HOW TO RUN: paste this whole file into the Supabase SQL Editor (DEVELOPMENT
-- project) and click Run. It returns one row per test plus a SUMMARY row.
--
-- SAFE: every change it makes (test users, tasks, submissions, coins, audit rows)
-- happens inside a sub-transaction that is always rolled back at the end, so the
-- database is left exactly as it was. The helper function lives in pg_temp and
-- disappears when the session ends.
--
-- It impersonates roles the same way the Supabase API does: by switching the
-- Postgres role (anon / authenticated) and setting request.jwt.claims.
-- Expected denials must fail with the SPECIFIC expected SQLSTATE, so a typo or an
-- unrelated error can never be counted as a pass.

create or replace function pg_temp.taskmint_permission_tests()
returns table (test_no bigint, test text, passed boolean, detail text)
language plpgsql
as $fn$
declare
  res        jsonb := '[]'::jsonb;
  sfx        text  := substr(md5(random()::text), 1, 8);
  u_a        uuid  := gen_random_uuid();
  u_b        uuid  := gen_random_uuid();
  u_admin    uuid  := gen_random_uuid();
  t_active   uuid;
  t_draft    uuid;
  t_closed   uuid;
  s_a        uuid;
  s_b        uuid;
  s_admin    uuid;
  slug_a     text;
  n          bigint;
  m          bigint;
  bal        bigint;
  txt        text;
  j          jsonb;
  new_slug   text;
  t_ev       uuid;
  t_soon     uuid;
  s_ev       uuid;
  s_soon     uuid;
  p_a1       text;
  p_a2       text;
  p_b        text;
  t_rev      uuid;
  v          text;
  c_admin    uuid := gen_random_uuid();
  c_x        uuid := gen_random_uuid();
  c_y        uuid := gen_random_uuid();
  c_z        uuid := gen_random_uuid();
  t_c1       uuid;
  t_c2       uuid;
  t_c3       uuid;
  sx1        uuid;
  sy1        uuid;
  sy2        uuid;
  sz2        uuid;
  s_manual   uuid;
  r_x        bigint;
  r_y        bigint;
  r_z        bigint;
  s_rev      uuid;
  allowed_profile_keys text[] := array['username','display_name','avatar_url','bio','social_links','lifetime_coins',
                                      'leaderboard_rank','approved_tasks','member_since'];
  allowed_board_keys   text[] := array['leaderboard_rank','username','display_name','avatar_url',
                                      'public_slug','lifetime_coins','approved_tasks'];
begin
  begin -- ======== everything inside this block is rolled back at the end ========

    -- ------------------------------------------------------------------ setup
    -- (runs as the SQL Editor's own role)
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values
      (u_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'rls-a-' || sfx || '@taskmint.test',
       -- A malicious signup trying to self-assign admin through metadata:
       jsonb_build_object('username', 'rt_a_' || sfx, 'role', 'admin'), '{}'::jsonb, now(), now()),
      (u_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'rls-b-' || sfx || '@taskmint.test',
       jsonb_build_object('username', 'rt_b_' || sfx), '{}'::jsonb, now(), now()),
      (u_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'rls-admin-' || sfx || '@taskmint.test',
       jsonb_build_object('username', 'rt_adm_' || sfx), '{}'::jsonb, now(), now());

    select role::text into txt from public.profiles where id = u_a;
    res := res || jsonb_build_object('t', 'New account gets role "user" even if signup metadata says admin',
                                     'ok', txt = 'user', 'd', 'role=' || coalesce(txt, '<no profile>'));

    update public.profiles set role = 'admin' where id = u_admin;
    select public_slug into slug_a from public.profiles where id = u_a;

    insert into public.tasks (title, description, reward_coins, status)
      values ('RLS test active task', 'Test', 50, 'active') returning id into t_active;
    insert into public.tasks (title, description, reward_coins, status)
      values ('RLS test draft task', 'Test', 70, 'draft') returning id into t_draft;
    insert into public.tasks (title, description, reward_coins, status, deadline)
      values ('RLS test closed task', 'Test', 30, 'active', now() - interval '1 day') returning id into t_closed;

    -- -------------------------------------------------------------- anonymous
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);

    begin
      select count(*) into n from public.tasks;
      res := res || jsonb_build_object('t', 'Anon cannot read tasks', 'ok', false, 'd', 'read ' || n || ' rows');
    exception when others then
      res := res || jsonb_build_object('t', 'Anon cannot read tasks', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      select count(*) into n from public.profiles;
      res := res || jsonb_build_object('t', 'Anon cannot read profiles table', 'ok', false, 'd', 'read ' || n || ' rows');
    exception when others then
      res := res || jsonb_build_object('t', 'Anon cannot read profiles table', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      select count(*) into n from public.task_submissions;
      res := res || jsonb_build_object('t', 'Anon cannot read submissions', 'ok', false, 'd', 'read ' || n || ' rows');
    exception when others then
      res := res || jsonb_build_object('t', 'Anon cannot read submissions', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      select count(*) into n from public.coin_transactions;
      res := res || jsonb_build_object('t', 'Anon cannot read coin ledger', 'ok', false, 'd', 'read ' || n || ' rows');
    exception when others then
      res := res || jsonb_build_object('t', 'Anon cannot read coin ledger', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      select count(*) into n from public.audit_logs;
      res := res || jsonb_build_object('t', 'Anon cannot read audit log', 'ok', false, 'd', 'read ' || n || ' rows');
    exception when others then
      res := res || jsonb_build_object('t', 'Anon cannot read audit log', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.review_submission(gen_random_uuid(), 'approved');
      res := res || jsonb_build_object('t', 'Anon cannot call review_submission', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Anon cannot call review_submission', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform * from public.get_leaderboard(10);
      res := res || jsonb_build_object('t', 'Anon can call get_leaderboard', 'ok', true, 'd', '');
    exception when others then
      res := res || jsonb_build_object('t', 'Anon can call get_leaderboard', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- ----------------------------------------------------------------- user A
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);

    begin
      select count(*) filter (where id = t_active), count(*) filter (where id = t_draft)
        into n, bal from public.tasks where id in (t_active, t_draft);
      res := res || jsonb_build_object('t', 'User sees active tasks but not drafts',
                                       'ok', n = 1 and bal = 0, 'd', 'active=' || n || ' draft=' || bal);
    exception when others then
      res := res || jsonb_build_object('t', 'User sees active tasks but not drafts', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.tasks (title, description, reward_coins, status) values ('Hacked', 'x', 9999, 'active');
      res := res || jsonb_build_object('t', 'User cannot create tasks', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot create tasks', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.profiles set role = 'admin' where id = u_a;
      res := res || jsonb_build_object('t', 'User cannot change own role', 'ok', false, 'd', 'update succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot change own role', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.profiles set display_name = 'pwned' where id = u_b;
      get diagnostics n = row_count;
      res := res || jsonb_build_object('t', 'User cannot edit another user''s profile', 'ok', n = 0, 'd', n || ' rows updated');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot edit another user''s profile', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.profiles set display_name = 'Tester A' where id = u_a;
      get diagnostics n = row_count;
      res := res || jsonb_build_object('t', 'User can edit own display name', 'ok', n = 1, 'd', n || ' rows updated');
    exception when others then
      res := res || jsonb_build_object('t', 'User can edit own display name', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.profiles
      set social_links = '{"website":"https://example.com/","github":"https://github.com/octocat"}'::jsonb
      where id = u_a;
      get diagnostics n = row_count;
      res := res || jsonb_build_object('t', 'User can save valid social links', 'ok', n = 1, 'd', n || ' rows updated');
    exception when others then
      res := res || jsonb_build_object('t', 'User can save valid social links', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.profiles set social_links = '{"website":"javascript:alert(1)"}'::jsonb where id = u_a;
      res := res || jsonb_build_object('t', 'Database rejects a javascript: social link', 'ok', false, 'd', 'update succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Database rejects a javascript: social link', 'ok', sqlstate = '23514', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.profiles set social_links = '{"github":"https://evil.example/octocat"}'::jsonb where id = u_a;
      res := res || jsonb_build_object('t', 'Database rejects a social link to the wrong site', 'ok', false, 'd', 'update succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Database rejects a social link to the wrong site', 'ok', sqlstate = '23514', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.profiles set social_links = '{"myspace":"https://myspace.com/a"}'::jsonb where id = u_a;
      res := res || jsonb_build_object('t', 'Database rejects an unknown social platform', 'ok', false, 'd', 'update succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Database rejects an unknown social platform', 'ok', sqlstate = '23514', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.profiles set public_slug = 'aaaaaaaaaaaa' where id = u_a;
      res := res || jsonb_build_object('t', 'User cannot choose their public URL slug directly', 'ok', false, 'd', 'update succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot choose their public URL slug directly', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.task_submissions (task_id, proof_text) values (t_active, 'Done!') returning id into s_a;
      select status::text into txt from public.task_submissions where id = s_a;
      res := res || jsonb_build_object('t', 'User can submit to an active task (status pending)', 'ok', txt = 'pending', 'd', 'status=' || txt);
    exception when others then
      res := res || jsonb_build_object('t', 'User can submit to an active task (status pending)', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.task_submissions (task_id, proof_text) values (t_active, 'Again');
      res := res || jsonb_build_object('t', 'User cannot submit twice to the same task', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot submit twice to the same task', 'ok', sqlstate = '23505', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.task_submissions (task_id, proof_text) values (t_draft, 'Sneaky');
      res := res || jsonb_build_object('t', 'User cannot submit to a draft task', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot submit to a draft task', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.task_submissions (task_id, proof_text) values (t_closed, 'Late');
      res := res || jsonb_build_object('t', 'User cannot submit after the deadline', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot submit after the deadline', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.task_submissions (task_id, user_id, proof_text) values (t_active, u_b, 'As B');
      res := res || jsonb_build_object('t', 'User cannot submit on behalf of someone else', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot submit on behalf of someone else', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.task_submissions (task_id, proof_text, status) values (t_closed, 'x', 'approved');
      res := res || jsonb_build_object('t', 'User cannot create a pre-approved submission', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot create a pre-approved submission', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.task_submissions set status = 'approved' where id = s_a;
      res := res || jsonb_build_object('t', 'User cannot approve own submission by updating status', 'ok', false, 'd', 'update succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot approve own submission by updating status', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.coin_transactions (user_id, amount, kind, reason) values (u_a, 1000, 'admin_adjustment', 'free money');
      res := res || jsonb_build_object('t', 'User cannot insert coin transactions', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot insert coin transactions', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.review_submission(s_a, 'approved');
      res := res || jsonb_build_object('t', 'User cannot call review_submission', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot call review_submission', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.admin_adjust_coins(u_a, 1000, 'free money');
      res := res || jsonb_build_object('t', 'User cannot call admin_adjust_coins', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot call admin_adjust_coins', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.set_user_role(u_a, 'admin');
      res := res || jsonb_build_object('t', 'User cannot promote self via set_user_role', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot promote self via set_user_role', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      select count(*) into n from public.audit_logs;
      res := res || jsonb_build_object('t', 'User sees no audit log rows', 'ok', n = 0, 'd', n || ' rows visible');
    exception when others then
      res := res || jsonb_build_object('t', 'User sees no audit log rows', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- ----------------------------------------------------------------- user B
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);

    begin
      select count(*) into n from public.task_submissions where id = s_a;
      res := res || jsonb_build_object('t', 'User cannot see another user''s submission', 'ok', n = 0, 'd', n || ' rows visible');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot see another user''s submission', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.task_submissions set proof_text = 'overwritten' where id = s_a;
      get diagnostics n = row_count;
      res := res || jsonb_build_object('t', 'User cannot edit another user''s submission', 'ok', n = 0, 'd', n || ' rows updated');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot edit another user''s submission', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.profiles set social_links = '{"website":"https://phish.example/"}'::jsonb, username = 'hijacked_' || sfx
      where id = u_a;
      get diagnostics n = row_count;
      res := res || jsonb_build_object('t', 'User cannot edit another user''s links or username', 'ok', n = 0, 'd', n || ' rows updated');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot edit another user''s links or username', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      select count(*) into n from public.profiles where id = u_a;
      res := res || jsonb_build_object('t', 'User cannot read another user''s private profile row', 'ok', n = 0, 'd', n || ' rows visible');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot read another user''s private profile row', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    insert into public.task_submissions (task_id, proof_text) values (t_active, 'B proof') returning id into s_b;

    -- ------------------------------------------------------------------ admin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);

    begin
      select count(*) into n from public.task_submissions where id in (s_a, s_b);
      res := res || jsonb_build_object('t', 'Admin can see all submissions', 'ok', n = 2, 'd', n || ' rows visible');
    exception when others then
      res := res || jsonb_build_object('t', 'Admin can see all submissions', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.task_submissions set status = 'approved' where id = s_a;
      res := res || jsonb_build_object('t', 'Admin cannot bypass review by updating status directly', 'ok', false, 'd', 'update succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Admin cannot bypass review by updating status directly', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.coin_transactions (user_id, amount, kind, reason) values (u_a, 5, 'admin_adjustment', 'direct');
      res := res || jsonb_build_object('t', 'Admin cannot insert ledger rows directly', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Admin cannot insert ledger rows directly', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.review_submission(s_a, 'approved', 'Nice work');
      select count(*), coalesce(sum(amount), 0) into n, bal from public.coin_transactions where submission_id = s_a;
      select status::text into txt from public.task_submissions where id = s_a;
      res := res || jsonb_build_object('t', 'Admin approval marks approved and credits reward once',
                                       'ok', txt = 'approved' and n = 1 and bal = 50,
                                       'd', 'status=' || txt || ' rows=' || n || ' amount=' || bal);
    exception when others then
      res := res || jsonb_build_object('t', 'Admin approval marks approved and credits reward once', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.review_submission(s_a, 'approved');
      res := res || jsonb_build_object('t', 'Approving the same submission again is rejected', 'ok', false, 'd', 'second approval succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Approving the same submission again is rejected', 'ok', sqlstate = '55000', 'd', sqlstate || ' ' || sqlerrm);
    end;

    select count(*) into n from public.coin_transactions where submission_id = s_a;
    res := res || jsonb_build_object('t', 'Still exactly one reward row after the repeat attempt', 'ok', n = 1, 'd', n || ' rows');

    begin
      perform public.review_submission(s_b, 'rejected', 'Missing proof');
      select count(*) into n from public.coin_transactions where submission_id = s_b;
      res := res || jsonb_build_object('t', 'Rejection pays nothing', 'ok', n = 0, 'd', n || ' reward rows');
    exception when others then
      res := res || jsonb_build_object('t', 'Rejection pays nothing', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    insert into public.task_submissions (task_id, proof_text) values (t_active, 'Admin work') returning id into s_admin;
    begin
      perform public.review_submission(s_admin, 'approved');
      res := res || jsonb_build_object('t', 'Admin cannot approve own submission', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Admin cannot approve own submission', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.admin_adjust_coins(u_admin, 100, 'self bonus');
      res := res || jsonb_build_object('t', 'Admin cannot adjust own balance', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Admin cannot adjust own balance', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.admin_adjust_coins(u_a, -51, 'too much');
      res := res || jsonb_build_object('t', 'Adjustment cannot make a balance negative', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Adjustment cannot make a balance negative', 'ok', sqlstate = '23514', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      bal := public.admin_adjust_coins(u_a, 10, 'Bonus for great work');
      res := res || jsonb_build_object('t', 'Admin can adjust another user''s balance', 'ok', bal = 60, 'd', 'new balance=' || bal);
    exception when others then
      res := res || jsonb_build_object('t', 'Admin can adjust another user''s balance', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.set_user_role(u_admin, 'user');
      res := res || jsonb_build_object('t', 'Admin cannot change own role', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Admin cannot change own role', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.tasks (title, description, reward_coins, status) values ('Admin made task', 'x', 5, 'draft');
      res := res || jsonb_build_object('t', 'Admin can create tasks', 'ok', true, 'd', '');
    exception when others then
      res := res || jsonb_build_object('t', 'Admin can create tasks', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      select count(*) into n from public.audit_logs
      where actor_id = u_admin
        and action in ('submission.approved', 'submission.rejected', 'coins.adjusted', 'task.created');
      res := res || jsonb_build_object('t', 'Admin actions are recorded in the audit log', 'ok', n = 4, 'd', n || ' entries (expected 4)');
    exception when others then
      res := res || jsonb_build_object('t', 'Admin actions are recorded in the audit log', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- ------------------------------------------------- admin dashboard (step 12)
    -- setup: a fresh active task with one pending submission from user B
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '', true);
    insert into public.tasks (title, description, reward_coins, status)
      values ('RLS test review task', 'Test', 15, 'active') returning id into t_rev;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    insert into public.task_submissions (task_id, proof_text) values (t_rev, 'For review') returning id into s_rev;

    -- ordinary user A
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);

    begin
      perform * from public.admin_list_users(null, 10, 0);
      res := res || jsonb_build_object('t', 'User cannot list users (admin directory)', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot list users (admin directory)', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.admin_dashboard_stats();
      res := res || jsonb_build_object('t', 'User cannot read admin statistics', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot read admin statistics', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.tasks set reward_coins = 9999, status = 'active' where id = t_draft;
      get diagnostics n = row_count;
      res := res || jsonb_build_object('t', 'User cannot edit or publish tasks', 'ok', n = 0, 'd', n || ' rows updated');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot edit or publish tasks', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.review_submission(s_rev, 'rejected', 'Nope');
      res := res || jsonb_build_object('t', 'User cannot reject another user''s submission', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot reject another user''s submission', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- anonymous
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    begin
      perform * from public.admin_list_users(null, 10, 0);
      res := res || jsonb_build_object('t', 'Anon cannot list users', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Anon cannot list users', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- admin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);

    begin
      select to_jsonb(u) into j from public.admin_list_users('rt_a_' || sfx, 10, 0) u;
      res := res || jsonb_build_object('t', 'Admin can search users and see their email',
                                       'ok', j ->> 'email' = 'rls-a-' || sfx || '@taskmint.test' and (j ->> 'total_count')::int = 1,
                                       'd', coalesce(j::text, '<no row>'));
    exception when others then
      res := res || jsonb_build_object('t', 'Admin can search users and see their email', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      select count(*) into n from public.admin_list_users('_', 100, 0);
      select count(*) into bal from public.profiles where username like '%\_%' or display_name like '%\_%';
      res := res || jsonb_build_object('t', 'User search treats wildcards literally', 'ok', n <= bal and n >= 3,
                                       'd', n || ' matches for "_"');
    exception when others then
      res := res || jsonb_build_object('t', 'User search treats wildcards literally', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      j := public.admin_dashboard_stats();
      res := res || jsonb_build_object('t', 'Admin statistics are computed from stored rows',
                                       'ok', (j ->> 'users_total')::int >= 3
                                             and (j ->> 'submissions_pending')::int >= 2
                                             and (j ->> 'coins_rewarded')::int >= 50
                                             and (j ->> 'tasks_draft')::int >= 1,
                                       'd', j::text);
    exception when others then
      res := res || jsonb_build_object('t', 'Admin statistics are computed from stored rows', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.review_submission(s_rev, 'rejected', null);
      res := res || jsonb_build_object('t', 'Rejection without a reason is refused', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Rejection without a reason is refused', 'ok', sqlstate = '22023', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.review_submission(s_rev, 'rejected', '  x ');
      res := res || jsonb_build_object('t', 'Rejection with a too-short reason is refused', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Rejection with a too-short reason is refused', 'ok', sqlstate = '22023', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.review_submission(s_rev, 'rejected', 'Screenshot is missing');
      select status::text, review_note into txt, v from public.task_submissions where id = s_rev;
      select count(*) into n from public.coin_transactions where submission_id = s_rev;
      select count(*) into m from public.audit_logs
        where action = 'submission.rejected' and target_id = s_rev and actor_id = u_admin
          and details ->> 'note' = 'Screenshot is missing';
      res := res || jsonb_build_object('t', 'Rejection with a reason is saved, pays nothing and is audited',
                                       'ok', txt = 'rejected' and v = 'Screenshot is missing' and n = 0 and m = 1,
                                       'd', 'status=' || txt || ' ledger=' || n || ' audit=' || m);
    exception when others then
      res := res || jsonb_build_object('t', 'Rejection with a reason is saved, pays nothing and is audited', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.review_submission(s_rev, 'approved');
      res := res || jsonb_build_object('t', 'A rejected submission cannot be approved later', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'A rejected submission cannot be approved later', 'ok', sqlstate = '55000', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.tasks set status = 'active', reward_coins = 25 where id = t_draft;
      get diagnostics n = row_count;
      select count(*) into m from public.audit_logs
        where action = 'task.updated' and target_id = t_draft and actor_id = u_admin
          and details -> 'before' ->> 'status' = 'draft' and details -> 'after' ->> 'status' = 'active';
      res := res || jsonb_build_object('t', 'Admin can publish a task and the change is audited', 'ok', n = 1 and m = 1,
                                       'd', 'updated=' || n || ' audit=' || m);
    exception when others then
      res := res || jsonb_build_object('t', 'Admin can publish a task and the change is audited', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.tasks set reward_coins = 0 where id = t_draft;
      res := res || jsonb_build_object('t', 'Task rewards must be positive', 'ok', false, 'd', 'update succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Task rewards must be positive', 'ok', sqlstate = '23514', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      delete from public.tasks where id = t_draft;
      get diagnostics n = row_count;
      res := res || jsonb_build_object('t', 'Tasks cannot be deleted (archive instead)', 'ok', n = 0, 'd', n || ' rows deleted');
    exception when others then
      res := res || jsonb_build_object('t', 'Tasks cannot be deleted (archive instead)', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.set_user_role(u_b, 'admin');
      select role::text into txt from public.profiles where id = u_b;
      select count(*) into n from public.audit_logs
        where action = 'profile.role_changed' and target_id = u_b and actor_id = u_admin
          and details ->> 'from' = 'user' and details ->> 'to' = 'admin';
      perform public.set_user_role(u_b, 'user');
      select count(*) into m from public.audit_logs where action = 'profile.role_changed' and target_id = u_b;
      res := res || jsonb_build_object('t', 'Admin can change another user''s role and both changes are audited',
                                       'ok', txt = 'admin' and n = 1 and m = 2, 'd', 'role=' || txt || ' audit=' || m);
    exception when others then
      res := res || jsonb_build_object('t', 'Admin can change another user''s role and both changes are audited', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- ------------------------------------------------- user A: own history only
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);

    begin
      select count(*) into n from public.coin_transactions;
      select count(*), max(balance) into m, bal from public.coin_balances;
      res := res || jsonb_build_object('t', 'User sees own ledger (2 rows) and own balance (60) only',
                                       'ok', n = 2 and bal = 60 and m = 1,
                                       'd', 'ledger rows=' || n || ' balance rows=' || m || ' balance=' || bal);
    exception when others then
      res := res || jsonb_build_object('t', 'User sees own ledger (2 rows) and own balance (60) only', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.task_submissions set proof_text = 'edited after approval' where id = s_a;
      get diagnostics n = row_count;
      res := res || jsonb_build_object('t', 'User cannot edit a submission after review', 'ok', n = 0, 'd', n || ' rows updated');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot edit a submission after review', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- ------------------------------------------------------ user B: isolation
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);

    begin
      select count(*) into n from public.coin_transactions where user_id = u_a;
      select count(*) into bal from public.coin_balances where user_id = u_a;
      res := res || jsonb_build_object('t', 'User cannot see another user''s ledger or balance', 'ok', n = 0 and bal = 0,
                                       'd', 'ledger rows=' || n || ' balance rows=' || bal);
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot see another user''s ledger or balance', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.task_submissions (task_id, proof_text) values (t_active, 'Second try');
      res := res || jsonb_build_object('t', 'User can resubmit after a rejection', 'ok', true, 'd', '');
    exception when others then
      res := res || jsonb_build_object('t', 'User can resubmit after a rejection', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- ------------------------------------------- evidence uploads & deadlines
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '', true);
    insert into public.tasks (title, description, reward_coins, status, evidence_required, requirements)
      values ('RLS test evidence task', 'Test', 20, 'active', true, 'Upload a screenshot') returning id into t_ev;
    insert into public.tasks (title, description, reward_coins, status, deadline)
      values ('RLS test closing task', 'Test', 10, 'active', now() + interval '1 hour') returning id into t_soon;
    p_a1 := u_a::text || '/' || gen_random_uuid()::text || '.png';
    p_a2 := u_a::text || '/' || gen_random_uuid()::text || '.pdf';
    p_b  := u_b::text || '/' || gen_random_uuid()::text || '.jpg';

    -- anonymous
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    begin
      insert into storage.objects (bucket_id, name) values ('submission-evidence', u_a::text || '/' || gen_random_uuid()::text || '.png');
      res := res || jsonb_build_object('t', 'Anon cannot upload evidence', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Anon cannot upload evidence', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- user B uploads a file of their own (used below)
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    insert into storage.objects (bucket_id, name) values ('submission-evidence', p_b);

    -- user A
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);

    begin
      insert into storage.objects (bucket_id, name) values ('submission-evidence', p_a1);
      res := res || jsonb_build_object('t', 'User can upload evidence into own folder', 'ok', true, 'd', '');
    exception when others then
      res := res || jsonb_build_object('t', 'User can upload evidence into own folder', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into storage.objects (bucket_id, name) values ('submission-evidence', u_b::text || '/' || gen_random_uuid()::text || '.png');
      res := res || jsonb_build_object('t', 'User cannot upload into another user''s folder', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot upload into another user''s folder', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.task_submissions (task_id, proof_text) values (t_ev, 'No file');
      res := res || jsonb_build_object('t', 'Evidence-required task rejects a submission without a file', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Evidence-required task rejects a submission without a file', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.task_submissions (task_id, evidence_path) values (t_ev, p_b);
      res := res || jsonb_build_object('t', 'User cannot attach another user''s file', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot attach another user''s file', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.task_submissions (task_id, evidence_path)
        values (t_ev, u_a::text || '/' || gen_random_uuid()::text || '.png');
      res := res || jsonb_build_object('t', 'User cannot attach a file that was never uploaded', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot attach a file that was never uploaded', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.task_submissions (task_id, proof_text, evidence_path) values (t_ev, 'See file', p_a1) returning id into s_ev;
      res := res || jsonb_build_object('t', 'User can submit with their own uploaded evidence', 'ok', s_ev is not null, 'd', '');
    exception when others then
      res := res || jsonb_build_object('t', 'User can submit with their own uploaded evidence', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.task_submissions (task_id, evidence_path) values (t_soon, p_a1);
      res := res || jsonb_build_object('t', 'The same evidence file cannot back two submissions', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'The same evidence file cannot back two submissions', 'ok', sqlstate = '23505', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.task_submissions set evidence_path = p_a2 where id = s_ev;
      res := res || jsonb_build_object('t', 'Evidence on a submission cannot be swapped later', 'ok', false, 'd', 'update succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Evidence on a submission cannot be swapped later', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update storage.objects set metadata = '{"tampered":true}'::jsonb where name = p_a1;
      get diagnostics n = row_count;
      res := res || jsonb_build_object('t', 'Evidence files cannot be overwritten', 'ok', n = 0, 'd', n || ' rows updated');
    exception when others then
      res := res || jsonb_build_object('t', 'Evidence files cannot be overwritten', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      delete from storage.objects where name = p_a1;
      get diagnostics n = row_count;
      res := res || jsonb_build_object('t', 'Submitted evidence cannot be deleted by its owner', 'ok', n = 0, 'd', n || ' rows deleted');
    exception when others then
      res := res || jsonb_build_object('t', 'Submitted evidence cannot be deleted by its owner', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into storage.objects (bucket_id, name) values ('submission-evidence', p_a2);
      delete from storage.objects where name = p_a2;
      get diagnostics n = row_count;
      res := res || jsonb_build_object('t', 'User can delete their own unattached upload', 'ok', n = 1, 'd', n || ' rows deleted');
    exception when others then
      res := res || jsonb_build_object('t', 'User can delete their own unattached upload', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.task_submissions (task_id, proof_text) values (t_soon, 'Before the deadline') returning id into s_soon;
      res := res || jsonb_build_object('t', 'User can submit before the deadline', 'ok', s_soon is not null, 'd', '');
    exception when others then
      res := res || jsonb_build_object('t', 'User can submit before the deadline', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- user B
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);

    begin
      select count(*) into n from storage.objects where name = p_a1;
      res := res || jsonb_build_object('t', 'User cannot see another user''s evidence file', 'ok', n = 0, 'd', n || ' rows visible');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot see another user''s evidence file', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      select count(*) into n from public.task_submissions where id = s_ev;
      res := res || jsonb_build_object('t', 'User cannot see another user''s evidence submission', 'ok', n = 0, 'd', n || ' rows visible');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot see another user''s evidence submission', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      delete from storage.objects where name = p_a1;
      get diagnostics n = row_count;
      res := res || jsonb_build_object('t', 'User cannot delete another user''s evidence', 'ok', n = 0, 'd', n || ' rows deleted');
    exception when others then
      res := res || jsonb_build_object('t', 'User cannot delete another user''s evidence', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- admin
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
    begin
      select count(*) into n from storage.objects where name = p_a1;
      res := res || jsonb_build_object('t', 'Admin can read submitted evidence for review', 'ok', n = 1, 'd', n || ' rows visible');
    exception when others then
      res := res || jsonb_build_object('t', 'Admin can read submitted evidence for review', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- the deadline passes (server-side clock)
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '', true);
    update public.tasks set deadline = now() - interval '1 minute' where id = t_soon;
    perform set_config('role', 'authenticated', true);

    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_b, 'role', 'authenticated')::text, true);
    begin
      insert into public.task_submissions (task_id, proof_text) values (t_soon, 'Too late');
      res := res || jsonb_build_object('t', 'Submissions are rejected once the deadline passes', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Submissions are rejected once the deadline passes', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    begin
      update public.task_submissions set proof_text = 'Edited after deadline' where id = s_soon;
      get diagnostics n = row_count;
      res := res || jsonb_build_object('t', 'Pending submissions cannot be edited after the deadline', 'ok', n = 0, 'd', n || ' rows updated');
    exception when others then
      res := res || jsonb_build_object('t', 'Pending submissions cannot be edited after the deadline', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- --------------------------------------------------------- public access
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);

    begin
      select to_jsonb(p) into j from public.get_public_profile(slug_a) p;
      res := res || jsonb_build_object('t', 'Public profile returns only allow-listed fields',
                                       'ok', j is not null
                                             and (select array_agg(k order by k) from jsonb_object_keys(j) k)
                                                 = (select array_agg(k order by k) from unnest(allowed_profile_keys) k)
                                             and (j ->> 'lifetime_coins')::bigint = 60
                                             and j -> 'social_links' ->> 'github' = 'https://github.com/octocat'
                                             and j::text not like '%@taskmint.test%',
                                       'd', coalesce(j::text, '<no row>'));
    exception when others then
      res := res || jsonb_build_object('t', 'Public profile returns only allow-listed fields', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      select to_jsonb(l) into j from public.get_leaderboard(100) l where l.username = 'rt_a_' || sfx;
      res := res || jsonb_build_object('t', 'Leaderboard returns only allow-listed fields',
                                       'ok', j is not null
                                             and (select array_agg(k order by k) from jsonb_object_keys(j) k)
                                                 = (select array_agg(k order by k) from unnest(allowed_board_keys) k)
                                             and (j ->> 'lifetime_coins')::bigint = 60,
                                       'd', coalesce(j::text, '<not on leaderboard>'));
    exception when others then
      res := res || jsonb_build_object('t', 'Leaderboard returns only allow-listed fields', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- A regenerates their public URL: the old link (and old QR codes) must stop working.
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    begin
      new_slug := public.regenerate_public_slug();
      perform set_config('role', 'anon', true);
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      select count(*) into n from public.get_public_profile(slug_a);
      select count(*) into bal from public.get_public_profile(new_slug);
      res := res || jsonb_build_object('t', 'Regenerating the public URL retires the old one',
                                       'ok', new_slug <> slug_a and new_slug ~ '^[a-f0-9]{12}$' and n = 0 and bal = 1,
                                       'd', 'old slug rows=' || n || ' new slug rows=' || bal);
      slug_a := new_slug;
    exception when others then
      res := res || jsonb_build_object('t', 'Regenerating the public URL retires the old one', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- A hides their profile
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', u_a, 'role', 'authenticated')::text, true);
    update public.profiles set is_public = false where id = u_a;
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);

    begin
      select count(*) into n from public.get_public_profile(slug_a);
      select count(*) into bal from public.get_leaderboard(100) l where l.username = 'rt_a_' || sfx;
      res := res || jsonb_build_object('t', 'Private profile is hidden from public profile and leaderboard',
                                       'ok', n = 0 and bal = 0, 'd', 'profile rows=' || n || ' leaderboard rows=' || bal);
    exception when others then
      res := res || jsonb_build_object('t', 'Private profile is hidden from public profile and leaderboard', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- ----------------------------------------- database-level guarantees
    -- (back to the SQL Editor's own privileged role)
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '', true);

    begin
      insert into public.coin_transactions (user_id, amount, kind, submission_id) values (u_a, 50, 'task_reward', s_a);
      res := res || jsonb_build_object('t', 'UNIQUE constraint blocks a second reward even for privileged roles', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'UNIQUE constraint blocks a second reward even for privileged roles', 'ok', sqlstate = '23505', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.coin_transactions set amount = 99999 where submission_id = s_a;
      res := res || jsonb_build_object('t', 'Ledger rows cannot be edited, even by privileged roles', 'ok', false, 'd', 'update succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Ledger rows cannot be edited, even by privileged roles', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      update public.audit_logs set details = '{}'::jsonb where actor_id = u_admin;
      res := res || jsonb_build_object('t', 'Audit log rows cannot be edited, even by privileged roles', 'ok', false, 'd', 'update succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Audit log rows cannot be edited, even by privileged roles', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      truncate public.coin_transactions;
      res := res || jsonb_build_object('t', 'Ledger cannot be truncated', 'ok', false, 'd', 'truncate succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Ledger cannot be truncated', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- Deleting an admin account must not be blocked by the append-only rules, and
    -- must keep the ledger/audit history (with the actor set to null).
    begin
      delete from auth.users where id = u_admin;
      select count(*) filter (where created_by is null), count(*) into n, bal
        from public.coin_transactions where user_id = u_a;
      select count(*) into m from public.audit_logs
        where target_id in (s_a, s_b, u_a) and actor_id is null;
      res := res || jsonb_build_object('t', 'Deleting an admin keeps ledger and audit history',
                                       'ok', n = 2 and bal = 2 and m = 3,
                                       'd', 'ledger rows=' || bal || ' (actor cleared ' || n || '), audit rows=' || m);
    exception when others then
      res := res || jsonb_build_object('t', 'Deleting an admin keeps ledger and audit history', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- ------------------------------------------------ coins & leaderboard (step 13)
    -- Fresh users/tasks so earlier assertions are unaffected.
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '', true);
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values
      (c_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coin-admin-' || sfx || '@taskmint.test',
       jsonb_build_object('username', 'ct_adm_' || sfx), '{}'::jsonb, now(), now()),
      (c_x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coin-x-' || sfx || '@taskmint.test',
       jsonb_build_object('username', 'ct_x_' || sfx), '{}'::jsonb, now(), now()),
      (c_y, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coin-y-' || sfx || '@taskmint.test',
       jsonb_build_object('username', 'ct_y_' || sfx), '{}'::jsonb, now(), now()),
      (c_z, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coin-z-' || sfx || '@taskmint.test',
       jsonb_build_object('username', 'ct_z_' || sfx), '{}'::jsonb, now(), now());
    update public.profiles set role = 'admin' where id = c_admin;
    insert into public.tasks (title, description, reward_coins, status) values ('Coin task 40', 'x', 40, 'active') returning id into t_c1;
    insert into public.tasks (title, description, reward_coins, status) values ('Coin task 25', 'x', 25, 'active') returning id into t_c2;
    insert into public.tasks (title, description, reward_coins, status) values ('Coin task 10', 'x', 10, 'active') returning id into t_c3;

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', c_x, 'role', 'authenticated')::text, true);
    insert into public.task_submissions (task_id, proof_text) values (t_c1, 'x did it') returning id into sx1;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', c_y, 'role', 'authenticated')::text, true);
    insert into public.task_submissions (task_id, proof_text) values (t_c1, 'y did it') returning id into sy1;
    insert into public.task_submissions (task_id, proof_text) values (t_c2, 'y did it too') returning id into sy2;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', c_z, 'role', 'authenticated')::text, true);
    insert into public.task_submissions (task_id, proof_text) values (t_c2, 'z did it') returning id into sz2;

    -- Reward eligibility (R4), checked even for privileged SQL
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '', true);
    select count(*) into n from public.coin_transactions where user_id = c_x;
    res := res || jsonb_build_object('t', 'A pending submission earns nothing', 'ok', n = 0, 'd', n || ' ledger rows');

    begin
      insert into public.coin_transactions (user_id, amount, kind, submission_id) values (c_x, 40, 'task_reward', sx1);
      res := res || jsonb_build_object('t', 'No reward for a submission that isn''t approved (even privileged SQL)', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'No reward for a submission that isn''t approved (even privileged SQL)', 'ok', sqlstate = '23514', 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- an approved submission with no reward yet, created directly for the next checks
    insert into public.task_submissions (task_id, user_id, proof_text, status, reviewed_by, reviewed_at)
      values (t_c3, c_y, 'manual', 'approved', c_admin, now()) returning id into s_manual;

    begin
      insert into public.coin_transactions (user_id, amount, kind, submission_id) values (c_y, 999, 'task_reward', s_manual);
      res := res || jsonb_build_object('t', 'A reward must equal the task''s configured amount', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'A reward must equal the task''s configured amount', 'ok', sqlstate = '23514', 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.coin_transactions (user_id, amount, kind, submission_id) values (c_x, 10, 'task_reward', s_manual);
      res := res || jsonb_build_object('t', 'A reward can only go to the submission''s author', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'A reward can only go to the submission''s author', 'ok', sqlstate = '23514', 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- (clean up the manual row so it doesn't count below)
    delete from public.task_submissions where id = s_manual;

    -- Leaderboard before any approval
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    select count(*) into n from public.get_leaderboard(100) l where l.username like 'ct\_%\_' || sfx;
    res := res || jsonb_build_object('t', 'Users without approved work are not on the leaderboard', 'ok', n = 0, 'd', n || ' entries');

    -- Admin approves (the trusted reward path)
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', c_admin, 'role', 'authenticated')::text, true);
    begin
      perform public.review_submission(sx1, 'approved');
      perform public.review_submission(sy1, 'approved');
      perform public.review_submission(sy2, 'approved');
      select coalesce(sum(amount), 0), count(*) into bal, n from public.coin_transactions where user_id = c_y;
      res := res || jsonb_build_object('t', 'Approval credits exactly the configured reward per submission',
                                       'ok', bal = 65 and n = 2, 'd', 'y: ' || n || ' rows, ' || bal || ' coins');
    exception when others then
      res := res || jsonb_build_object('t', 'Approval credits exactly the configured reward per submission', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.review_submission(sy1, 'approved');
      res := res || jsonb_build_object('t', 'Repeated approval request is refused', 'ok', false, 'd', 'call succeeded');
    exception when others then
      select count(*) into n from public.coin_transactions where submission_id = sy1;
      res := res || jsonb_build_object('t', 'Repeated approval request is refused', 'ok', sqlstate = '55000' and n = 1,
                                       'd', sqlstate || ' · ledger rows=' || n);
    end;

    -- Changing a task's reward later doesn't rewrite past rewards
    perform set_config('role', 'none', true);
    update public.tasks set reward_coins = 99 where id = t_c2;
    select coalesce(sum(amount), 0) into bal from public.coin_transactions where user_id = c_y;
    res := res || jsonb_build_object('t', 'Past rewards are unchanged when a task''s reward is edited', 'ok', bal = 65, 'd', bal || ' coins');
    perform set_config('role', 'authenticated', true);

    -- Balance rules (R2, R3, R5)
    begin
      perform public.admin_adjust_coins(c_y, -15, 'Correction: duplicate effort');
      perform public.admin_adjust_coins(c_x, -41, 'Too much');
      res := res || jsonb_build_object('t', 'A debit larger than the balance is refused', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'A debit larger than the balance is refused', 'ok', sqlstate = '23514', 'd', sqlstate || ' ' || sqlerrm);
    end;
    -- (the -15 above was rolled back with the failed block; apply it on its own)
    perform public.admin_adjust_coins(c_y, -15, 'Correction: duplicate effort');

    perform set_config('role', 'none', true);
    begin
      insert into public.coin_transactions (user_id, amount, kind, reason) values (c_x, -41, 'admin_adjustment', 'bypass attempt');
      res := res || jsonb_build_object('t', 'Balances can''t go negative even via privileged SQL', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Balances can''t go negative even via privileged SQL', 'ok', sqlstate = '23514', 'd', sqlstate || ' ' || sqlerrm);
    end;

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', c_y, 'role', 'authenticated')::text, true);
    begin
      select to_jsonb(s) into j from public.get_my_coin_summary() s;
      select to_jsonb(b) into txt from public.coin_balances b where b.user_id = c_y;
      res := res || jsonb_build_object('t', 'Balance and lifetime earnings are computed from the ledger',
                                       'ok', (j ->> 'balance')::int = 50 and (j ->> 'lifetime_earned')::int = 50
                                             and (j ->> 'rewards_count')::int = 2
                                             and (txt::jsonb ->> 'balance')::int = 50 and (txt::jsonb ->> 'lifetime_earned')::int = 50,
                                       'd', j::text);
    exception when others then
      res := res || jsonb_build_object('t', 'Balance and lifetime earnings are computed from the ledger', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      select count(*) into n from public.coin_balances;
      res := res || jsonb_build_object('t', 'A user sees only their own balance row', 'ok', n = 1, 'd', n || ' rows');
    exception when others then
      res := res || jsonb_build_object('t', 'A user sees only their own balance row', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      insert into public.coin_balances (user_id, balance) values (c_y, 1000000);
      res := res || jsonb_build_object('t', 'Users cannot write balances', 'ok', false, 'd', 'insert succeeded');
    exception when others then
      -- 55000 = view not insertable; 42501 = no privilege. Also assert no write privilege exists.
      res := res || jsonb_build_object('t', 'Users cannot write balances',
                                       'ok', sqlstate in ('42501', '55000')
                                             and not has_table_privilege('authenticated', 'public.coin_balances', 'INSERT, UPDATE, DELETE'),
                                       'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform public.review_submission(sy2, 'approved');
      res := res || jsonb_build_object('t', 'Users cannot trigger rewards for themselves', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Users cannot trigger rewards for themselves', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- Leaderboard rankings (R7)
    perform set_config('request.jwt.claims', jsonb_build_object('sub', c_admin, 'role', 'authenticated')::text, true);
    -- z is approved AFTER the task's reward was edited to 99, so z earns 99.
    perform public.review_submission(sz2, 'approved');
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    begin
      select max(l.leaderboard_rank) filter (where l.username = 'ct_x_' || sfx),
             max(l.leaderboard_rank) filter (where l.username = 'ct_y_' || sfx),
             max(l.leaderboard_rank) filter (where l.username = 'ct_z_' || sfx)
        into r_x, r_y, r_z
      from public.get_leaderboard(100) l;
      select max(l.lifetime_coins) into bal from public.get_leaderboard(100) l where l.username = 'ct_z_' || sfx;
      -- lifetimes: z 99 (task reward was 99 when approved), y 50, x 40
      res := res || jsonb_build_object('t', 'Leaderboard ranks by lifetime earnings and updates right after approval',
                                       'ok', r_z < r_y and r_y < r_x and bal = 99,
                                       'd', format('ranks x=%s y=%s z=%s, z lifetime=%s', r_x, r_y, r_z, bal));
    exception when others then
      res := res || jsonb_build_object('t', 'Leaderboard ranks by lifetime earnings and updates right after approval', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- tie: give x +10 so x = y = 50
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', c_admin, 'role', 'authenticated')::text, true);
    perform public.admin_adjust_coins(c_x, 10, 'Bonus to tie');
    -- z goes private
    perform set_config('request.jwt.claims', jsonb_build_object('sub', c_z, 'role', 'authenticated')::text, true);
    update public.profiles set is_public = false where id = c_z;
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    begin
      select max(l.leaderboard_rank) filter (where l.username = 'ct_x_' || sfx),
             max(l.leaderboard_rank) filter (where l.username = 'ct_y_' || sfx),
             count(*) filter (where l.username = 'ct_z_' || sfx)
        into r_x, r_y, r_z
      from public.get_leaderboard(100) l;
      res := res || jsonb_build_object('t', 'Equal earnings share a rank; private profiles are excluded',
                                       'ok', r_x = r_y and r_z = 0, 'd', format('x=%s y=%s z entries=%s', r_x, r_y, r_z));
    exception when others then
      res := res || jsonb_build_object('t', 'Equal earnings share a rank; private profiles are excluded', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end;

    begin
      perform * from public.get_my_coin_summary();
      res := res || jsonb_build_object('t', 'Anon cannot read a coin summary', 'ok', false, 'd', 'call succeeded');
    exception when others then
      res := res || jsonb_build_object('t', 'Anon cannot read a coin summary', 'ok', sqlstate = '42501', 'd', sqlstate || ' ' || sqlerrm);
    end;

    -- A private user still sees their own standing (rank null while private)
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', c_z, 'role', 'authenticated')::text, true);
    select to_jsonb(s) into j from public.get_my_coin_summary() s;
    res := res || jsonb_build_object('t', 'A private user sees their own coins but no public rank',
                                     'ok', (j ->> 'lifetime_earned')::int = 99 and j ->> 'leaderboard_rank' is null
                                           and (j ->> 'is_public')::boolean = false,
                                     'd', j::text);

    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '', true);

    -- Always roll back everything above.
    raise exception 'TASKMINT_TEST_ROLLBACK';
  exception when others then
    if sqlerrm <> 'TASKMINT_TEST_ROLLBACK' then
      res := res || jsonb_build_object('t', 'Test run aborted unexpectedly', 'ok', false, 'd', sqlstate || ' ' || sqlerrm);
    end if;
  end;

  return query
    with r as (
      select ord, e ->> 't' as t, (e ->> 'ok')::boolean as ok, e ->> 'd' as d
      from jsonb_array_elements(res) with ordinality as x(e, ord)
    )
    select 0::bigint,
           format('SUMMARY: %s of %s tests passed', count(*) filter (where r.ok), count(*)),
           bool_and(r.ok),
           'All test data was rolled back.'
    from r
    union all
    select r.ord, r.t, r.ok, r.d from r
    order by 1;
end;
$fn$;

select * from pg_temp.taskmint_permission_tests();
