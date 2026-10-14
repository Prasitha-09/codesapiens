-- TaskMint · Migration 4: submission requirements and private evidence uploads
--
-- Depends on migrations 1–3. Run once, in a DEVELOPMENT project first.
--
-- Adds:
--   * tasks.requirements / tasks.evidence_required  (what a submission must include)
--   * task_submissions.evidence_path                 (optional file in private storage)
--   * a PRIVATE storage bucket `submission-evidence` with per-user folders:
--       <user_id>/<random>.<ext>
--     - users upload only into their own folder, read only their own files
--     - admins can read all evidence (for review)
--     - nobody can overwrite a file; users can delete only files that no
--       submission references (cleanup of failed uploads), so submitted
--       evidence can't be swapped or removed afterwards
--   * stricter submission rules enforced in RLS: evidence must be the caller's
--     own uploaded file, required evidence must be present, and pending
--     submissions can't be edited once the deadline has passed.

-- ===========================================================================
-- Tasks: submission requirements
-- ===========================================================================
alter table public.tasks
  add column requirements text
    check (requirements is null or char_length(btrim(requirements)) between 1 and 2000),
  add column evidence_required boolean not null default false;

grant insert (requirements, evidence_required) on table public.tasks to authenticated;
grant update (requirements, evidence_required) on table public.tasks to authenticated;

-- Audit task changes including the new fields.
create or replace function public.audit_task_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_new jsonb := jsonb_build_object(
    'title', new.title, 'reward_coins', new.reward_coins, 'status', new.status, 'deadline', new.deadline,
    'requirements', new.requirements, 'evidence_required', new.evidence_required);
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, target_type, target_id, details)
    values ((select auth.uid()), 'task.created', 'task', new.id, snapshot_new);
  else
    insert into public.audit_logs (actor_id, action, target_type, target_id, details)
    values ((select auth.uid()), 'task.updated', 'task', new.id,
            jsonb_build_object(
              'before', jsonb_build_object('title', old.title, 'reward_coins', old.reward_coins,
                                           'status', old.status, 'deadline', old.deadline,
                                           'requirements', old.requirements,
                                           'evidence_required', old.evidence_required),
              'after', snapshot_new));
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- Submissions: evidence file reference
-- ===========================================================================
alter table public.task_submissions
  add column evidence_path text
    check (evidence_path is null or evidence_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp|pdf)$');

-- The file must live in the submitter's own folder.
alter table public.task_submissions
  add constraint task_submissions_evidence_in_own_folder
    check (evidence_path is null or split_part(evidence_path, '/', 1) = user_id::text);

-- A file can back at most one submission.
create unique index task_submissions_evidence_path_key
  on public.task_submissions (evidence_path)
  where evidence_path is not null;

-- Proof can now be text, a link, or a file.
alter table public.task_submissions drop constraint task_submissions_has_proof;
alter table public.task_submissions
  add constraint task_submissions_has_proof
    check (proof_text is not null or proof_url is not null or evidence_path is not null);

-- Clients may attach evidence when creating a submission, never change it later.
grant insert (evidence_path) on table public.task_submissions to authenticated;

-- ===========================================================================
-- Submission RLS (replaces migration 2's insert/update policies)
-- ===========================================================================
drop policy "Users submit to open active tasks as themselves" on public.task_submissions;
create policy "Users submit to open active tasks as themselves"
  on public.task_submissions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    -- Task must be active and not past its deadline (server clock, not the client's).
    and exists (
      select 1 from public.tasks t
      where t.id = task_submissions.task_id
        and t.status = 'active'
        and (t.deadline is null or t.deadline > now())
        and (not t.evidence_required or task_submissions.evidence_path is not null)
    )
    -- Evidence must be a file the caller actually uploaded to their own folder.
    and (
      evidence_path is null
      or (
        split_part(evidence_path, '/', 1) = (select auth.uid())::text
        and exists (
          select 1 from storage.objects o
          where o.bucket_id = 'submission-evidence'
            and o.name = task_submissions.evidence_path
        )
      )
    )
  );

drop policy "Users edit their own pending submissions" on public.task_submissions;
create policy "Users edit their own pending submissions before the deadline"
  on public.task_submissions for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.tasks t
      where t.id = task_submissions.task_id
        and t.status = 'active'
        and (t.deadline is null or t.deadline > now())
    )
  )
  with check (user_id = (select auth.uid()) and status = 'pending');

-- ===========================================================================
-- Storage: private evidence bucket
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submission-evidence', 'submission-evidence', false, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Evidence: users upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'submission-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Evidence: users read their own files; admins read all"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'submission-evidence'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_admin())
    )
  );

-- Only files not attached to any submission (e.g. an upload whose submission
-- then failed) can be deleted, and only by their owner.
create policy "Evidence: users delete their own unattached files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'submission-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1 from public.task_submissions s
      where s.evidence_path = storage.objects.name
    )
  );

-- No UPDATE policy: evidence files can never be overwritten or renamed.
