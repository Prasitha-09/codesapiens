-- Minimal stand-in for the parts of a Supabase database that The Challenge Arena's
-- migrations rely on, so they can be tested locally in PGlite (in-memory Postgres).
-- This is NOT a full Supabase emulation — always also run
-- supabase/tests/permissions_test.sql against a real development project.

-- API roles, as in Supabase.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

-- auth schema with the columns our triggers/tests use.
create schema auth;
create table auth.users (
  id                  uuid primary key,
  instance_id         uuid,
  aud                 varchar(255),
  role                varchar(255),
  email               varchar(255) unique,
  encrypted_password  varchar(255),
  email_confirmed_at  timestamptz,
  raw_app_meta_data   jsonb,
  raw_user_meta_data  jsonb,
  last_sign_in_at     timestamptz,
  created_at          timestamptz,
  updated_at          timestamptz
);

-- Same definition Supabase uses: reads the JWT claims set per request.
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase's default privileges: new objects in `public` are fully granted to the
-- API roles. Our migrations must explicitly revoke what they don't want exposed.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Supabase Storage: the tables/function our storage policies use.
create schema storage;
create table storage.buckets (
  id                  text primary key,
  name                text not null,
  public              boolean default false,
  file_size_limit     bigint,
  allowed_mime_types  text[],
  created_at          timestamptz default now()
);
create table storage.objects (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   text references storage.buckets (id),
  name        text not null,
  owner_id    text default (auth.uid())::text,
  metadata    jsonb,
  created_at  timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

-- Same behaviour as Supabase: the folder segments of an object path.
create function storage.foldername(name text) returns text[]
language sql immutable
as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant all on table storage.objects to anon, authenticated, service_role;
grant select on table storage.buckets to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
