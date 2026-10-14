-- TaskMint · Migration 3: public social links on profiles
--
-- Depends on migrations 1–2. Run once, in a DEVELOPMENT project first.
--
-- Adds `profiles.social_links` (a small JSON object of allow-listed platforms →
-- https URLs), validated by the database itself so no client can store a
-- javascript:/data: URL, an unknown platform, or a link to the wrong site.
-- The URL rules mirror src/lib/profile/social-links.ts; a test checks both agree.

-- ---------------------------------------------------------------------------
-- Validator (IMMUTABLE so it can back a CHECK constraint)
-- ---------------------------------------------------------------------------
create or replace function public.valid_social_links(links jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(links) = 'object'
     and not exists (
       select 1
       from jsonb_each(links) as e(platform, url)
       where jsonb_typeof(e.url) <> 'string'
          or char_length(e.url #>> '{}') > 300
          or not coalesce(case e.platform
               when 'website'   then (e.url #>> '{}') ~ '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{1,5})?(/[^[:space:]<>"]*)?$'
               when 'github'    then (e.url #>> '{}') ~ '^https://(www\.)?github\.com/[A-Za-z0-9-]{1,39}/?$'
               when 'linkedin'  then (e.url #>> '{}') ~ '^https://([a-z]{2,3}\.)?linkedin\.com/(in|company)/[A-Za-z0-9_%-]{1,100}/?$'
               when 'x'         then (e.url #>> '{}') ~ '^https://(www\.)?(x|twitter)\.com/[A-Za-z0-9_]{1,15}/?$'
               when 'instagram' then (e.url #>> '{}') ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9_.]{1,30}/?$'
               when 'youtube'   then (e.url #>> '{}') ~ '^https://(www\.)?youtube\.com/(@[A-Za-z0-9_.-]{1,100}|(c|channel|user)/[A-Za-z0-9_.-]{1,100})/?$'
               else false  -- unknown platform
             end, false)
     );
$$;

revoke all on function public.valid_social_links(jsonb) from public, anon;
grant execute on function public.valid_social_links(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Column
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column social_links jsonb not null default '{}'::jsonb,
  add constraint profiles_social_links_valid check (public.valid_social_links(social_links));

-- Owners may edit their own links (the existing UPDATE policy limits it to their row).
grant update (social_links) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Public profile: add social_links to the allow-listed output.
-- The return type changes, so the function must be dropped and recreated.
-- ---------------------------------------------------------------------------
drop function public.get_public_profile(text);

create function public.get_public_profile(p_slug text)
returns table (
  username          text,
  display_name      text,
  avatar_url        text,
  bio               text,
  social_links      jsonb,
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
         p.social_links,
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

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
