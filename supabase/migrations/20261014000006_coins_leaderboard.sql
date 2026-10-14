-- TaskMint · Migration 6: coin ledger rules, lifetime earnings, leaderboard
--
-- Depends on migrations 1–5. Run once, in a DEVELOPMENT project first.
--
-- ===========================================================================
-- COIN TRANSACTION RULES (enforced by the database, for every role)
-- ===========================================================================
-- R1  The ledger (coin_transactions) is the only source of truth. Rows are
--     append-only: never updated, never deleted by clients, never truncated.
-- R2  Spendable balance  = SUM(amount) of ALL of a user's ledger rows.
-- R3  Lifetime earnings  = SUM(amount) of EARNING rows only:
--       * task_reward       (always positive)
--       * admin_adjustment  (credits, or negative corrections of earnings)
--     Any future SPENDING kind must NOT be added to the earning set, so
--     spending would lower the balance but never lifetime earnings.
--     (Spending is not part of the approved plan and is not implemented.)
-- R4  A task_reward row is valid only if its submission is APPROVED, belongs
--     to the same user, and its amount equals that task's configured
--     reward_coins at that moment. One reward per submission (UNIQUE).
-- R5  No write may make a user's balance negative. Writes for the same user
--     are serialized by locking their profile row, so concurrent writes can't
--     both pass the check.
-- R6  Clients can't write the ledger at all; rewards come only from
--     review_submission() (admin-only, atomic with the approval) and manual
--     credits/debits only from admin_adjust_coins() (admin-only, audited).
-- R7  The leaderboard ranks PUBLIC profiles by lifetime earnings (> 0), so it
--     is unaffected by (future) spending and updates as soon as an approval
--     commits — it is computed from the ledger on every read.

-- ===========================================================================
-- R4 + R5: integrity trigger on every ledger insert
-- ===========================================================================
create or replace function public.enforce_coin_ledger_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance bigint;
  v_ok      boolean;
begin
  -- R5: serialize all ledger writes for this user (concurrent writers queue here).
  perform 1 from public.profiles where id = new.user_id for update;
  if not found then
    raise exception 'Ledger user does not exist' using errcode = '23503';
  end if;

  -- R4: rewards must match a validly approved submission and the configured reward.
  if new.kind = 'task_reward' then
    select exists (
      select 1
      from public.task_submissions s
      join public.tasks t on t.id = s.task_id
      where s.id = new.submission_id
        and s.user_id = new.user_id
        and s.status = 'approved'
        and t.reward_coins = new.amount
    ) into v_ok;
    if not v_ok then
      raise exception 'A task reward needs an approved submission by the same user and the task''s configured amount'
        using errcode = '23514';
    end if;
  end if;

  -- R5: the balance can never go negative.
  select coalesce(sum(amount), 0) into v_balance
  from public.coin_transactions
  where user_id = new.user_id;
  if v_balance + new.amount < 0 then
    raise exception 'Coin balance would become negative' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_coin_ledger_rules() from public, anon, authenticated;

create trigger coin_transactions_enforce_rules
  before insert on public.coin_transactions
  for each row execute function public.enforce_coin_ledger_rules();

-- ===========================================================================
-- R2 + R3: balances view gains lifetime earnings (columns appended; RLS of the
-- caller still applies via security_invoker).
-- ===========================================================================
create or replace view public.coin_balances
with (security_invoker = true) as
  select user_id,
         sum(amount)::bigint as balance,
         count(*)::bigint as transaction_count,
         coalesce(sum(amount) filter (where kind in ('task_reward', 'admin_adjustment')), 0)::bigint
           as lifetime_earned,
         count(*) filter (where kind = 'task_reward')::bigint as rewards_count
  from public.coin_transactions
  group by user_id;

revoke all on table public.coin_balances from anon, authenticated;
grant select on table public.coin_balances to authenticated;

-- ===========================================================================
-- R7: leaderboard by lifetime earnings (public profiles only)
-- Return columns change, so drop and recreate.
-- ===========================================================================
drop function public.get_leaderboard(integer);

create function public.get_leaderboard(p_limit integer default 25)
returns table (
  leaderboard_rank  bigint,
  username          text,
  display_name      text,
  avatar_url        text,
  public_slug       text,
  lifetime_coins    bigint,
  approved_tasks    bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with earnings as (
    select user_id, sum(amount)::bigint as lifetime
    from public.coin_transactions
    where kind in ('task_reward', 'admin_adjustment')
    group by user_id
  )
  select rank() over (order by e.lifetime desc),
         p.username,
         p.display_name,
         p.avatar_url,
         p.public_slug,
         e.lifetime,
         (select count(*) from public.task_submissions s where s.user_id = p.id and s.status = 'approved')
  from earnings e
  join public.profiles p on p.id = e.user_id
  where p.is_public and e.lifetime > 0
  order by e.lifetime desc, p.username
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

revoke all on function public.get_leaderboard(integer) from public;
grant execute on function public.get_leaderboard(integer) to anon, authenticated;

-- ===========================================================================
-- Public profile: show lifetime earnings and the same rank as the leaderboard.
-- (The spendable balance is private to the owner and admins.)
-- ===========================================================================
drop function public.get_public_profile(text);

create function public.get_public_profile(p_slug text)
returns table (
  username          text,
  display_name      text,
  avatar_url        text,
  bio               text,
  social_links      jsonb,
  lifetime_coins    bigint,
  leaderboard_rank  bigint,
  approved_tasks    bigint,
  member_since      date
)
language sql
stable
security definer
set search_path = ''
as $$
  with earnings as (
    select p.id,
           coalesce(sum(c.amount) filter (where c.kind in ('task_reward', 'admin_adjustment')), 0)::bigint as lifetime
    from public.profiles p
    left join public.coin_transactions c on c.user_id = p.id
    where p.is_public
    group by p.id
  ),
  ranked as (
    select id, lifetime, rank() over (order by lifetime desc) as rnk
    from earnings
  )
  select p.username,
         p.display_name,
         p.avatar_url,
         p.bio,
         p.social_links,
         r.lifetime,
         case when r.lifetime > 0 then r.rnk end,
         (select count(*) from public.task_submissions s
          where s.user_id = p.id and s.status = 'approved'),
         p.created_at::date
  from public.profiles p
  join ranked r on r.id = p.id
  where p_slug ~ '^[a-f0-9]{12}$'
    and p.public_slug = p_slug
    and p.is_public;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- ===========================================================================
-- The signed-in user's own standing (even when their profile is private).
-- ===========================================================================
create or replace function public.get_my_coin_summary()
returns table (
  balance           bigint,
  lifetime_earned   bigint,
  rewards_count     bigint,
  leaderboard_rank  bigint,
  is_public         boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id, p.is_public from public.profiles p where p.id = (select auth.uid())
  ),
  mine as (
    select coalesce(sum(c.amount), 0)::bigint as balance,
           coalesce(sum(c.amount) filter (where c.kind in ('task_reward', 'admin_adjustment')), 0)::bigint as lifetime,
           count(*) filter (where c.kind = 'task_reward')::bigint as rewards
    from public.coin_transactions c
    where c.user_id = (select auth.uid())
  ),
  board as (
    select e.user_id, rank() over (order by e.lifetime desc) as rnk
    from (
      select c.user_id, sum(c.amount)::bigint as lifetime
      from public.coin_transactions c
      join public.profiles p on p.id = c.user_id and p.is_public
      where c.kind in ('task_reward', 'admin_adjustment')
      group by c.user_id
    ) e
    where e.lifetime > 0
  )
  select mine.balance,
         mine.lifetime,
         mine.rewards,
         (select b.rnk from board b where b.user_id = me.id),
         me.is_public
  from me cross join mine;
$$;

revoke all on function public.get_my_coin_summary() from public, anon;
grant execute on function public.get_my_coin_summary() to authenticated;
