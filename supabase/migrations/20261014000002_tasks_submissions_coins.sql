-- TaskMint · Migration 2: tasks, submissions, coin ledger, audit log
--
-- Depends on migration 1 (profiles, user_role, is_admin(), set_updated_at()).
-- Run once, in a DEVELOPMENT project first.
--
-- Security model in one paragraph:
--   * Clients (anon/authenticated) get only the table/column privileges listed in
--     the GRANT section; everything else is revoked, and RLS filters rows.
--   * Nobody can write `status`, `role`, coin rows or audit rows through the API.
--     Those change only inside the SECURITY DEFINER functions below, and each one
--     checks `is_admin()` (from the database, not from JWT metadata) first.
--   * Approving a submission and inserting its reward happen in one transaction,
--     with the submission row locked and a UNIQUE(submission_id) on the ledger, so
--     a submission can pay out at most once — even under concurrent approvals.

-- ===========================================================================
-- Types
-- ===========================================================================
create type public.task_status as enum ('draft', 'active', 'archived');
create type public.submission_status as enum ('pending', 'approved', 'rejected');
create type public.coin_tx_kind as enum ('task_reward', 'admin_adjustment');

-- ===========================================================================
-- Profiles hardening
-- ===========================================================================
-- Public avatar URLs must be https (no javascript:/data: URLs).
alter table public.profiles
  add constraint profiles_avatar_url_https check (avatar_url is null or avatar_url ~ '^https://');

-- ===========================================================================
-- Audit log (append-only; written only by trusted functions/triggers)
-- ===========================================================================
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null check (action in (
                 'task.created', 'task.updated',
                 'submission.approved', 'submission.rejected',
                 'coins.adjusted', 'profile.role_changed')),
  target_type  text not null check (target_type in ('task', 'submission', 'profile')),
  target_id    uuid not null,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

-- ===========================================================================
-- Tasks
-- ===========================================================================
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(btrim(title)) between 3 and 120),
  description   text not null check (char_length(btrim(description)) between 1 and 5000),
  reward_coins  integer not null check (reward_coins between 1 and 10000),
  status        public.task_status not null default 'draft',
  deadline      timestamptz,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index tasks_status_created_idx on public.tasks (status, created_at desc);
create index tasks_created_by_idx on public.tasks (created_by);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Task submissions
-- ===========================================================================
create table public.task_submissions (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete restrict,
  -- Defaults to the caller; clients have no privilege to set it explicitly.
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  proof_text   text check (proof_text is null or char_length(btrim(proof_text)) between 1 and 5000),
  proof_url    text check (proof_url is null or (proof_url ~ '^https?://' and char_length(proof_url) <= 2000)),
  status       public.submission_status not null default 'pending',
  review_note  text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint task_submissions_has_proof check (proof_text is not null or proof_url is not null),
  constraint task_submissions_review_consistent check ((status = 'pending') = (reviewed_at is null))
);

-- At most one pending-or-approved submission per user per task.
-- (A rejected submission doesn't block a new attempt.)
create unique index task_submissions_one_live_per_task
  on public.task_submissions (task_id, user_id)
  where status in ('pending', 'approved');

create index task_submissions_task_idx on public.task_submissions (task_id);
create index task_submissions_user_idx on public.task_submissions (user_id, created_at desc);
create index task_submissions_queue_idx on public.task_submissions (status, created_at);
create index task_submissions_reviewed_by_idx on public.task_submissions (reviewed_by);

create trigger task_submissions_set_updated_at
  before update on public.task_submissions
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Coin ledger (append-only). Balance = SUM(amount) per user.
-- ===========================================================================
create table public.coin_transactions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  amount         integer not null check (amount <> 0 and amount between -100000 and 100000),
  kind           public.coin_tx_kind not null,
  -- UNIQUE: one reward row per submission, enforced by the database itself.
  submission_id  uuid unique references public.task_submissions (id) on delete cascade,
  reason         text check (reason is null or char_length(reason) between 3 and 500),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint coin_transactions_kind_shape check (
    (kind = 'task_reward' and submission_id is not null and amount > 0)
    or (kind = 'admin_adjustment' and submission_id is null and reason is not null)
  )
);

create index coin_transactions_user_idx on public.coin_transactions (user_id, created_at desc);
create index coin_transactions_created_by_idx on public.coin_transactions (created_by);

-- Per-user balances. security_invoker = RLS of the caller applies, so users see
-- only their own balance and admins see everyone's.
create view public.coin_balances
with (security_invoker = true) as
  select user_id,
         sum(amount)::bigint as balance,
         count(*)::bigint as transaction_count
  from public.coin_transactions
  group by user_id;

-- ===========================================================================
-- Append-only protection for the ledger and the audit log.
-- Blocks UPDATE and TRUNCATE for every role, including table owners. The only
-- permitted update is the automatic `ON DELETE SET NULL` of the actor column
-- (passed as the trigger argument) when an admin account is deleted.
-- ===========================================================================
create or replace function public.prevent_append_only_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_col text := tg_argv[0];
  n jsonb;
  o jsonb;
begin
  if tg_op = 'UPDATE' and actor_col is not null then
    -- Compare as JSON so this works for any table without naming its columns.
    n := to_jsonb(new);
    o := to_jsonb(old);
    if n ->> actor_col is null
       and o ->> actor_col is not null
       and (n - actor_col) = (o - actor_col) then
      return new;
    end if;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

create trigger coin_transactions_append_only
  before update on public.coin_transactions
  for each row execute function public.prevent_append_only_update('created_by');
create trigger coin_transactions_no_truncate
  before truncate on public.coin_transactions
  for each statement execute function public.prevent_append_only_update();

create trigger audit_logs_append_only
  before update on public.audit_logs
  for each row execute function public.prevent_append_only_update('actor_id');
create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.prevent_append_only_update();

-- ===========================================================================
-- Audit trigger for task changes (tasks are edited by admins through RLS).
-- ===========================================================================
create or replace function public.audit_task_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_new jsonb := jsonb_build_object(
    'title', new.title, 'reward_coins', new.reward_coins, 'status', new.status, 'deadline', new.deadline);
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, target_type, target_id, details)
    values ((select auth.uid()), 'task.created', 'task', new.id, snapshot_new);
  else
    insert into public.audit_logs (actor_id, action, target_type, target_id, details)
    values ((select auth.uid()), 'task.updated', 'task', new.id,
            jsonb_build_object(
              'before', jsonb_build_object('title', old.title, 'reward_coins', old.reward_coins,
                                           'status', old.status, 'deadline', old.deadline),
              'after', snapshot_new));
  end if;
  return new;
end;
$$;

create trigger tasks_audit
  after insert or update on public.tasks
  for each row execute function public.audit_task_change();

-- ===========================================================================
-- Privileges. Supabase grants ALL on new objects to anon/authenticated by
-- default, so revoke everything and grant back the minimum.
-- ===========================================================================
revoke all on table public.tasks, public.task_submissions, public.coin_transactions,
                    public.audit_logs, public.coin_balances
  from anon, authenticated;

-- tasks: everyone signed in may read (RLS narrows it); admins write via RLS.
grant select on table public.tasks to authenticated;
grant insert (title, description, reward_coins, status, deadline) on table public.tasks to authenticated;
grant update (title, description, reward_coins, status, deadline) on table public.tasks to authenticated;

-- task_submissions: users may only supply the task and their proof.
-- status / user_id / reviewed_* are NOT grantable to clients.
grant select on table public.task_submissions to authenticated;
grant insert (task_id, proof_text, proof_url) on table public.task_submissions to authenticated;
grant update (proof_text, proof_url) on table public.task_submissions to authenticated;

-- Ledger, balances, audit: read-only for clients (RLS narrows rows).
grant select on table public.coin_transactions to authenticated;
grant select on table public.coin_balances to authenticated;
grant select on table public.audit_logs to authenticated;

-- Anonymous visitors get nothing here; public data is served by the
-- allow-listed functions get_public_profile() and get_leaderboard().

-- ===========================================================================
-- Row-level security
-- ===========================================================================
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.audit_logs enable row level security;

-- tasks ---------------------------------------------------------------------
create policy "Signed-in users read active tasks; admins read all"
  on public.tasks for select
  to authenticated
  using (status = 'active' or (select public.is_admin()));

create policy "Admins create tasks"
  on public.tasks for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins update tasks"
  on public.tasks for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- task_submissions ------------------------------------------------------------
create policy "Users read own submissions; admins read all"
  on public.task_submissions for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Users submit to open active tasks as themselves"
  on public.task_submissions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1 from public.tasks t
      where t.id = task_submissions.task_id
        and t.status = 'active'
        and (t.deadline is null or t.deadline > now())
    )
  );

create policy "Users edit their own pending submissions"
  on public.task_submissions for update
  to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (user_id = (select auth.uid()) and status = 'pending');

-- coin_transactions -----------------------------------------------------------
create policy "Users read own transactions; admins read all"
  on public.coin_transactions for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- audit_logs ------------------------------------------------------------------
create policy "Admins read the audit log"
  on public.audit_logs for select
  to authenticated
  using ((select public.is_admin()));

-- ===========================================================================
-- Privileged functions (SECURITY DEFINER, empty search_path, explicit checks)
-- ===========================================================================

-- Approve or reject a pending submission. Approval credits the task reward in
-- the same transaction. Admin-only; admins cannot review their own work.
create or replace function public.review_submission(
  p_submission_id uuid,
  p_decision public.submission_status,
  p_note text default null
)
returns public.task_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := (select auth.uid());
  v_sub    public.task_submissions;
  v_reward integer;
  v_note   text := nullif(btrim(p_note), '');
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'Only admins can review submissions' using errcode = '42501';
  end if;
  if p_decision is null or p_decision = 'pending' then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'Review note is too long' using errcode = '22001';
  end if;

  -- Lock the row: a concurrent review of the same submission waits here, then
  -- sees status <> 'pending' and fails below.
  select * into v_sub
  from public.task_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;
  if v_sub.user_id = v_actor then
    raise exception 'You cannot review your own submission' using errcode = '42501';
  end if;
  if v_sub.status <> 'pending' then
    raise exception 'Submission has already been reviewed' using errcode = '55000';
  end if;

  update public.task_submissions
  set status = p_decision,
      review_note = v_note,
      reviewed_by = v_actor,
      reviewed_at = now()
  where id = p_submission_id
  returning * into v_sub;

  if p_decision = 'approved' then
    -- Reward amount comes from the task row, never from the caller.
    select reward_coins into v_reward from public.tasks where id = v_sub.task_id;

    -- UNIQUE(submission_id) is the final guard against double payment.
    insert into public.coin_transactions (user_id, amount, kind, submission_id, created_by)
    values (v_sub.user_id, v_reward, 'task_reward', v_sub.id, v_actor);
  end if;

  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
  values (v_actor,
          case when p_decision = 'approved' then 'submission.approved' else 'submission.rejected' end,
          'submission', v_sub.id,
          jsonb_build_object('user_id', v_sub.user_id, 'task_id', v_sub.task_id,
                             'reward_coins', v_reward, 'note', v_note));

  return v_sub;
end;
$$;

-- Manually credit or debit a user's coins, with a mandatory reason.
-- Admin-only; admins cannot adjust their own balance; balances never go negative.
create or replace function public.admin_adjust_coins(
  p_user_id uuid,
  p_amount integer,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   uuid := (select auth.uid());
  v_reason  text := btrim(p_reason);
  v_balance bigint;
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'Only admins can adjust coins' using errcode = '42501';
  end if;
  if p_user_id = v_actor then
    raise exception 'Admins cannot adjust their own balance' using errcode = '42501';
  end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000 then
    raise exception 'Amount must be non-zero and at most 100000' using errcode = '22023';
  end if;
  if v_reason is null or char_length(v_reason) not between 3 and 500 then
    raise exception 'A reason of 3-500 characters is required' using errcode = '22023';
  end if;

  -- Serialize balance changes per user so the non-negative check is reliable.
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.coin_transactions
  where user_id = p_user_id;

  if v_balance + p_amount < 0 then
    raise exception 'Adjustment would make the balance negative' using errcode = '23514';
  end if;

  insert into public.coin_transactions (user_id, amount, kind, reason, created_by)
  values (p_user_id, p_amount, 'admin_adjustment', v_reason, v_actor);

  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
  values (v_actor, 'coins.adjusted', 'profile', p_user_id,
          jsonb_build_object('amount', p_amount, 'reason', v_reason,
                             'balance_before', v_balance, 'balance_after', v_balance + p_amount));

  return v_balance + p_amount;
end;
$$;

-- Change another user's role. Admin-only; admins cannot change their own role
-- (which also guarantees at least one admin always remains).
create or replace function public.set_user_role(
  p_user_id uuid,
  p_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_old   public.user_role;
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  if p_user_id = v_actor then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  if p_role is null then
    raise exception 'Role is required' using errcode = '22023';
  end if;

  select role into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if v_old = p_role then
    return;
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
  values (v_actor, 'profile.role_changed', 'profile', p_user_id,
          jsonb_build_object('from', v_old, 'to', p_role));
end;
$$;

-- Give the caller a new random public slug, invalidating old QR codes.
create or replace function public.regenerate_public_slug()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_slug  text;
begin
  if v_actor is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  update public.profiles
  set public_slug = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
  where id = v_actor
  returning public_slug into v_slug;

  if v_slug is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  return v_slug;
end;
$$;

-- Public QR profile: ONLY these allow-listed fields, ONLY for public profiles.
-- Never returns id, email, role, submissions or ledger rows.
create or replace function public.get_public_profile(p_slug text)
returns table (
  username          text,
  display_name      text,
  avatar_url        text,
  bio               text,
  coins             bigint,
  leaderboard_rank  bigint,
  approved_tasks    bigint,
  member_since      date
)
language sql
stable
security definer
set search_path = ''
as $$
  with balances as (
    select p.id, coalesce(sum(c.amount), 0)::bigint as coins
    from public.profiles p
    left join public.coin_transactions c on c.user_id = p.id
    where p.is_public
    group by p.id
  ),
  ranked as (
    select id, coins, rank() over (order by coins desc) as rnk
    from balances
  )
  select p.username,
         p.display_name,
         p.avatar_url,
         p.bio,
         r.coins,
         case when r.coins > 0 then r.rnk end,
         (select count(*) from public.task_submissions s
          where s.user_id = p.id and s.status = 'approved'),
         p.created_at::date
  from public.profiles p
  join ranked r on r.id = p.id
  where p_slug ~ '^[a-f0-9]{12}$'
    and p.public_slug = p_slug
    and p.is_public;
$$;

-- Leaderboard of public profiles with a positive balance. Allow-listed fields only.
create or replace function public.get_leaderboard(p_limit integer default 25)
returns table (
  leaderboard_rank  bigint,
  username          text,
  display_name      text,
  avatar_url        text,
  public_slug       text,
  coins             bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select rank() over (order by b.coins desc),
         p.username,
         p.display_name,
         p.avatar_url,
         p.public_slug,
         b.coins
  from (
    select user_id, sum(amount)::bigint as coins
    from public.coin_transactions
    group by user_id
  ) b
  join public.profiles p on p.id = b.user_id
  where p.is_public and b.coins > 0
  order by b.coins desc, p.username
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

-- ===========================================================================
-- Function privileges
-- ===========================================================================
-- Signed-in only (each function re-checks admin/ownership internally).
revoke all on function public.review_submission(uuid, public.submission_status, text) from public, anon;
revoke all on function public.admin_adjust_coins(uuid, integer, text) from public, anon;
revoke all on function public.set_user_role(uuid, public.user_role) from public, anon;
revoke all on function public.regenerate_public_slug() from public, anon;
grant execute on function public.review_submission(uuid, public.submission_status, text) to authenticated;
grant execute on function public.admin_adjust_coins(uuid, integer, text) to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.regenerate_public_slug() to authenticated;

-- Public read-only functions.
revoke all on function public.get_public_profile(text) from public;
revoke all on function public.get_leaderboard(integer) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
grant execute on function public.get_leaderboard(integer) to anon, authenticated;

-- Trigger functions are never called directly.
revoke all on function public.audit_task_change() from public, anon, authenticated;
revoke all on function public.prevent_append_only_update() from public, anon, authenticated;
