-- TaskMint · Migration 1: profiles and user/admin roles
--
-- Creates one profile per auth user (via trigger), stores the role in the database
-- (never in user-editable JWT metadata), and locks the table down with RLS and
-- column-level privileges so users cannot promote themselves.
--
-- Safe to run once in the Supabase SQL Editor. Tasks, submissions and the coin
-- ledger come in a later migration.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('user', 'admin');

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null unique
                  check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name  text check (char_length(display_name) between 1 and 50),
  avatar_url    text check (char_length(avatar_url) <= 500),
  bio           text check (char_length(bio) <= 280),
  role          public.user_role not null default 'user',
  is_public     boolean not null default true,
  -- Random, non-guessable id used in public QR profile URLs (not the user id).
  public_slug   text not null unique
                  default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.profiles.role is
  'Authorization source of truth. Not writable by clients; change only via SQL or an admin-only function.';

-- ---------------------------------------------------------------------------
-- Helper: is the current user an admin?
-- SECURITY DEFINER so it can read profiles without recursing into RLS.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Create a profile for every new auth user.
-- The requested username comes from signup metadata (user-controlled), so it is
-- validated here; if invalid or taken, a random fallback is used instead.
-- The role is NEVER read from metadata: every new user starts as 'user'.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  chosen    text;
begin
  if requested ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = requested) then
    chosen := requested;
  else
    chosen := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, chosen, chosen);

  return new;
exception
  -- A concurrent signup grabbed the same username between the check and insert.
  when unique_violation then
    insert into public.profiles (id, username, display_name)
    values (new.id,
            'user_' || substr(replace(new.id::text, '-', ''), 1, 10),
            'user_' || substr(replace(new.id::text, '-', ''), 1, 10));
    return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges: Supabase grants broad table access to anon/authenticated by
-- default, so reset them and grant back only what is needed.
-- ---------------------------------------------------------------------------
revoke all on table public.profiles from anon, authenticated;

grant select on table public.profiles to authenticated;
-- Column-level: users may edit only these fields. `role`, `id`, `public_slug`
-- and timestamps are not updatable through the API by anyone.
grant update (username, display_name, avatar_url, bio, is_public)
  on table public.profiles to authenticated;
-- No INSERT/DELETE grants: profiles are created by the trigger and removed
-- with the auth user (ON DELETE CASCADE).

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "Users can read their own profile; admins can read all"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Anonymous visitors get no direct access. Public QR profiles will be served by
-- a SECURITY DEFINER function that returns only allow-listed fields (Phase 8).
