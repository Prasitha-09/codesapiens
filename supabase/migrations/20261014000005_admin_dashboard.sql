-- TaskMint · Migration 5: admin dashboard support
--
-- Depends on migrations 1–4. Run once, in a DEVELOPMENT project first.
--
--   * review_submission(): a rejection now REQUIRES a reason (3–1000 chars).
--   * admin_list_users(): admin-only user directory, including the sign-in email
--     from auth.users (which clients can never read directly).
--   * admin_dashboard_stats(): admin-only statistics computed from stored rows.
--
-- Every function re-checks is_admin() from the database; hiding UI is never the
-- security boundary.

-- ===========================================================================
-- review_submission: same as migration 2, plus a mandatory rejection reason.
-- ===========================================================================
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
  if p_decision = 'rejected' and (v_note is null or char_length(v_note) < 3) then
    raise exception 'A rejection reason of at least 3 characters is required' using errcode = '22023';
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

-- (Privileges from migration 2 are kept by CREATE OR REPLACE.)

-- ===========================================================================
-- User directory for admins
-- ===========================================================================
create or replace function public.admin_list_users(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id               uuid,
  username         text,
  display_name     text,
  email            text,
  role             public.user_role,
  is_public        boolean,
  created_at       timestamptz,
  last_sign_in_at  timestamptz,
  coins            bigint,
  submissions      bigint,
  approved         bigint,
  total_count      bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_search text := nullif(btrim(p_search), '');
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Only admins can list users' using errcode = '42501';
  end if;
  if v_search is not null and char_length(v_search) > 100 then
    raise exception 'Search is too long' using errcode = '22001';
  end if;

  return query
  with matched as (
    select p.id, p.username, p.display_name, u.email::text as email, p.role, p.is_public,
           p.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where v_search is null
       -- Escape LIKE wildcards so the search is a plain substring match.
       or p.username ilike '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
       or coalesce(p.display_name, '') ilike '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
       or coalesce(u.email::text, '') ilike '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  )
  select m.id, m.username, m.display_name, m.email, m.role, m.is_public, m.created_at, m.last_sign_in_at,
         coalesce((select sum(c.amount) from public.coin_transactions c where c.user_id = m.id), 0)::bigint,
         (select count(*) from public.task_submissions s where s.user_id = m.id),
         (select count(*) from public.task_submissions s where s.user_id = m.id and s.status = 'approved'),
         count(*) over ()
  from matched m
  order by m.created_at desc, m.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_list_users(text, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, integer, integer) to authenticated;

-- ===========================================================================
-- Dashboard statistics (all computed from stored rows)
-- ===========================================================================
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Only admins can view statistics' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'users_total',        (select count(*) from public.profiles),
    'admins_total',       (select count(*) from public.profiles where role = 'admin'),
    'users_new_7d',       (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'tasks_draft',        (select count(*) from public.tasks where status = 'draft'),
    'tasks_active',       (select count(*) from public.tasks where status = 'active'),
    'tasks_archived',     (select count(*) from public.tasks where status = 'archived'),
    'submissions_pending',  (select count(*) from public.task_submissions where status = 'pending'),
    'submissions_approved', (select count(*) from public.task_submissions where status = 'approved'),
    'submissions_rejected', (select count(*) from public.task_submissions where status = 'rejected'),
    'oldest_pending_at',  (select min(created_at) from public.task_submissions where status = 'pending'),
    'reviews_7d',         (select count(*) from public.task_submissions where reviewed_at > now() - interval '7 days'),
    'coins_rewarded',     (select coalesce(sum(amount), 0) from public.coin_transactions where kind = 'task_reward'),
    'coins_adjusted',     (select coalesce(sum(amount), 0) from public.coin_transactions where kind = 'admin_adjustment'),
    'coins_in_circulation', (select coalesce(sum(amount), 0) from public.coin_transactions)
  );
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
