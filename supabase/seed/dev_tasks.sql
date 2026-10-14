-- Code Sapiens · DEVELOPMENT seed: sample tasks
--
-- Optional. Inserts a few real task rows so you can try the Tasks pages before
-- the admin task editor exists. Run in the SQL Editor of a DEVELOPMENT project
-- (after migrations 1–4). Safe to run more than once: it skips titles that exist.
-- Rows created here are recorded in the audit log with no actor.

insert into public.tasks (title, description, requirements, reward_coins, status, deadline, evidence_required)
select v.title, v.description, v.requirements, v.reward_coins, 'active', v.deadline, v.evidence_required
from (values
  ('Share The Challenge Arena with a friend',
   'Tell a friend about The Challenge Arena and invite them to sign up.',
   'Add a short note saying who you invited.',
   20, null::timestamptz, false),
  ('Complete your public profile',
   'Add a display name, a bio and at least one social link to your profile.',
   'Paste the link to your public profile page.',
   30, now() + interval '14 days', false),
  ('Screenshot challenge',
   'Take a screenshot of your My Arena page.',
   'Upload the screenshot (PNG or JPEG).',
   50, now() + interval '7 days', true),
  ('Expired example task',
   'This task''s deadline has already passed, to show how closed tasks look.',
   null,
   10, now() - interval '1 day', false)
) as v(title, description, requirements, reward_coins, deadline, evidence_required)
where not exists (select 1 from public.tasks t where t.title = v.title);
