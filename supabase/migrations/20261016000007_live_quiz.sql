-- Quiz data is accessed exclusively through allow-listed transactional RPCs.
create table public.quiz_events (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100),
 join_code text not null unique check(join_code ~ '^[A-Z0-9]{4,12}$'),
 status text not null default 'lobby' check(status in ('lobby','live','paused','ended')),
 submission_mode text not null default 'captain' check(submission_mode in ('captain','any')),
 current_question uuid, submissions_open boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.quiz_teams (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.quiz_events(id),
 name text not null check(length(name) between 1 and 60), color text not null default '#FFD95A' check(color ~ '^#[0-9A-Fa-f]{6}$'),
 capacity integer not null default 6 check(capacity between 1 and 100), unique(event_id,name), unique(id,event_id)
);
create table public.quiz_participants (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.quiz_events(id),
 user_id uuid not null references auth.users(id), team_id uuid not null,
 name text not null check(length(name) between 1 and 60), captain boolean not null default false,
 foreign key(team_id,event_id) references public.quiz_teams(id,event_id), unique(event_id,user_id)
);
create unique index quiz_one_captain on public.quiz_participants(team_id) where captain;
create table public.quiz_rounds (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.quiz_events(id),
 name text not null check(length(name) between 1 and 60), points integer not null check(points between 1 and 1000),
 position integer not null check(position > 0), unique(id,event_id)
);
create table public.quiz_questions (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.quiz_events(id), round_id uuid not null,
 prompt text not null check(length(prompt) between 1 and 2000), kind text not null check(kind in ('mcq','short')),
 options jsonb not null default '[]', answer_key text not null check(length(answer_key) between 1 and 500),
 position integer not null check(position > 0), published boolean not null default false,
 foreign key(round_id,event_id) references public.quiz_rounds(id,event_id), unique(id,event_id),
 check(jsonb_typeof(options)='array'), check(kind <> 'mcq' or (jsonb_array_length(options) between 2 and 6 and options ? answer_key))
);
alter table public.quiz_events add foreign key(current_question,id) references public.quiz_questions(id,event_id);
create table public.quiz_submissions (
 id uuid primary key default gen_random_uuid(), event_id uuid not null, question_id uuid not null, team_id uuid not null,
 participant_id uuid not null references public.quiz_participants(id), answer text not null check(length(answer) between 1 and 500),
 verdict text not null default 'pending' check(verdict in ('pending','correct','wrong')), created_at timestamptz not null default now(),
 foreign key(question_id,event_id) references public.quiz_questions(id,event_id),
 foreign key(team_id,event_id) references public.quiz_teams(id,event_id), unique(question_id,team_id)
);
create table public.quiz_scores (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.quiz_events(id), team_id uuid not null,
 submission_id uuid unique references public.quiz_submissions(id), points integer not null check(points between -10000 and 10000),
 reason text not null check(length(reason) between 1 and 500), actor uuid references auth.users(id), created_at timestamptz not null default now(),
 foreign key(team_id,event_id) references public.quiz_teams(id,event_id)
);
create table public.quiz_audit (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.quiz_events(id),
 actor uuid references auth.users(id), action text not null, detail jsonb not null, created_at timestamptz not null default now()
);
create table public.quiz_signal (event_id uuid primary key references public.quiz_events(id), updated_at timestamptz not null default now());
do $$ declare t text; begin
 foreach t in array array['quiz_events','quiz_teams','quiz_participants','quiz_rounds','quiz_questions','quiz_submissions','quiz_scores','quiz_audit','quiz_signal'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
grant select on public.quiz_signal to anon, authenticated;
create policy "Public quiz invalidation only" on public.quiz_signal for select using(true);
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 alter publication supabase_realtime add table public.quiz_signal;
 end if;
end $$;

create function public.quiz_state(p_event uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e public.quiz_events; q jsonb; me jsonb; teams jsonb; begin
 select * into e from public.quiz_events where p_event is null or id=p_event order by created_at desc limit 1;
 if e.id is null then return jsonb_build_object('event',null,'teams','[]'::jsonb); end if;
 select jsonb_build_object('id',x.id,'prompt',x.prompt,'kind',x.kind,'options',x.options,'round',r.name,'points',r.points,
 'number',(select count(*) from public.quiz_questions z join public.quiz_rounds rz on rz.id=z.round_id where z.event_id=e.id and (rz.position,z.position,z.id) <= (r.position,x.position,x.id))) into q
 from public.quiz_questions x join public.quiz_rounds r on r.id=x.round_id where x.id=e.current_question and x.published;
 select jsonb_build_object('id',p.id,'name',p.name,'team_id',p.team_id,'captain',p.captain,'submission',
 (select jsonb_build_object('answer',s.answer,'verdict',s.verdict) from public.quiz_submissions s where s.team_id=p.team_id and s.question_id=e.current_question)) into me
 from public.quiz_participants p where p.event_id=e.id and p.user_id=auth.uid();
 select coalesce(jsonb_agg(to_jsonb(b) order by b.score desc,b.name),'[]'::jsonb) into teams from (
 select t.id,t.name,t.color,t.capacity,(select count(*) from public.quiz_participants p where p.team_id=t.id) members,
 coalesce((select sum(s.points) from public.quiz_scores s where s.team_id=t.id),0) score,
 rank() over(order by coalesce((select sum(s.points) from public.quiz_scores s where s.team_id=t.id),0) desc) rank
 from public.quiz_teams t where t.event_id=e.id) b;
 return jsonb_build_object('event',jsonb_build_object('id',e.id,'name',e.name,'status',e.status,'submissions_open',e.submissions_open,'submission_mode',e.submission_mode),
 'question',q,'participant',me,'teams',teams,'total_questions',(select count(*) from public.quiz_questions where event_id=e.id));
end $$;

create function public.quiz_join(p_code text,p_name text,p_team uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.quiz_events; t public.quiz_teams; result uuid; begin
 if auth.uid() is null then raise exception 'Sign in to join'; end if;
 select * into e from public.quiz_events where join_code=upper(trim(p_code)) for update;
 if e.id is null then raise exception 'Invalid join code'; end if;
 select id into result from public.quiz_participants where event_id=e.id and user_id=auth.uid();
 if result is not null then return result; end if;
 if e.status <> 'lobby' then raise exception 'Registration is closed'; end if;
 select * into t from public.quiz_teams x where x.event_id=e.id and (p_team is null or x.id=p_team)
 and (select count(*) from public.quiz_participants where team_id=x.id)<x.capacity order by x.name limit 1;
 if t.id is null then raise exception 'No space in this team'; end if;
 insert into public.quiz_participants(event_id,user_id,team_id,name,captain)
 values(e.id,auth.uid(),t.id,trim(p_name),not exists(select 1 from public.quiz_participants where team_id=t.id)) returning id into result;
 insert into public.quiz_signal values(e.id,clock_timestamp()) on conflict(event_id) do update set updated_at=excluded.updated_at;
 return result;
end $$;

create function public.quiz_submit(p_event uuid,p_question uuid,p_answer text) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.quiz_events; p public.quiz_participants; q public.quiz_questions; s uuid; correct boolean; pts integer; begin
 select * into e from public.quiz_events where id=p_event for update;
 if e.id is null or e.status<>'live' or not e.submissions_open or e.current_question is distinct from p_question then raise exception 'Submissions are closed'; end if;
 select * into p from public.quiz_participants where event_id=e.id and user_id=auth.uid();
 if p.id is null or (e.submission_mode='captain' and not p.captain) then raise exception 'Only an authorized team member can submit'; end if;
 select * into q from public.quiz_questions where id=p_question and published;
 if q.id is null then raise exception 'Question unavailable'; end if;
 if q.kind='mcq' and not q.options ? p_answer then raise exception 'Select a listed option'; end if;
 correct := q.kind='mcq' and p_answer=q.answer_key;
 insert into public.quiz_submissions(event_id,question_id,team_id,participant_id,answer,verdict)
 values(e.id,q.id,p.team_id,p.id,trim(p_answer),case when q.kind='short' then 'pending' when correct then 'correct' else 'wrong' end) returning id into s;
 if correct then
 select points into pts from public.quiz_rounds where id=q.round_id;
 insert into public.quiz_scores(event_id,team_id,submission_id,points,reason,actor) values(e.id,p.team_id,s,pts,'Correct multiple-choice answer',auth.uid());
 end if;
 insert into public.quiz_signal values(e.id,clock_timestamp()) on conflict(event_id) do update set updated_at=excluded.updated_at;
 return s;
end $$;

create function public.quiz_admin_state(p_event uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e uuid; result jsonb; begin
 if not public.is_admin() then raise exception 'Administrator access required'; end if;
 select id into e from public.quiz_events where p_event is null or id=p_event order by created_at desc limit 1;
 result := public.quiz_state(e);
 return result || jsonb_build_object(
 'events',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from public.quiz_events x),
 'settings',(select to_jsonb(x) from public.quiz_events x where id=e),
 'rounds',(select coalesce(jsonb_agg(to_jsonb(x) order by position,id),'[]'::jsonb) from public.quiz_rounds x where event_id=e),
 'questions',(select coalesce(jsonb_agg(to_jsonb(x) order by r.position,x.position,x.id),'[]'::jsonb) from public.quiz_questions x join public.quiz_rounds r on r.id=x.round_id where x.event_id=e),
 'participants',(select coalesce(jsonb_agg(to_jsonb(x) order by name),'[]'::jsonb) from public.quiz_participants x where event_id=e),
 'submissions',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]'::jsonb) from public.quiz_submissions x where event_id=e),
 'scores',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]'::jsonb) from public.quiz_scores x where event_id=e),
 'audit',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]'::jsonb) from (select * from public.quiz_audit where event_id=e order by created_at desc limit 100) x));
end $$;

create function public.quiz_admin(p_action text,p_event uuid default null,p_data jsonb default '{}') returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.quiz_events; target uuid := nullif(p_data->>'id','')::uuid; result uuid; q public.quiz_questions; s public.quiz_submissions; pts integer; begin
 if not public.is_admin() then raise exception 'Administrator access required'; end if;
 if p_action='create_event' then
 insert into public.quiz_events(name,join_code) values(trim(p_data->>'name'),upper(trim(p_data->>'join_code'))) returning * into e;
 insert into public.quiz_rounds(event_id,name,points,position) values(e.id,'Round 1',5,1),(e.id,'Round 2',10,2),(e.id,'Final Round',20,3);
 else
 select * into e from public.quiz_events where id=p_event for update;
 if e.id is null then raise exception 'Event not found'; end if;
 end if;
 result := e.id;
 if p_action='settings' then
 update public.quiz_events set name=trim(p_data->>'name'),join_code=upper(trim(p_data->>'join_code')),submission_mode=p_data->>'submission_mode' where id=e.id;
 elsif p_action='status' then
 if not ((e.status='lobby' and p_data->>'status'='live') or (e.status='live' and p_data->>'status' in ('paused','ended')) or (e.status='paused' and p_data->>'status' in ('live','ended'))) then raise exception 'Invalid event transition'; end if;
 update public.quiz_events set status=p_data->>'status',submissions_open=false where id=e.id;
 elsif p_action='window' then
 if e.status<>'live' or e.current_question is null then raise exception 'Start the event and publish a question first'; end if;
 update public.quiz_events set submissions_open=(p_data->>'open')::boolean where id=e.id;
 elsif p_action='publish' then
 if e.status='ended' then raise exception 'Event has ended'; end if;
 select * into q from public.quiz_questions where id=target and event_id=e.id;
 if q.id is null then raise exception 'Question not found'; end if;
 update public.quiz_questions set published=true where id=q.id;
 update public.quiz_events set current_question=q.id,submissions_open=false where id=e.id;
 elsif p_action in ('team','round','question','delete_team','delete_round','delete_question') then
 if e.status<>'lobby' then raise exception 'Edit event content before starting'; end if;
 if p_action='team' then
 if target is null then
 insert into public.quiz_teams(event_id,name,color,capacity) values(e.id,trim(p_data->>'name'),p_data->>'color',(p_data->>'capacity')::integer) returning id into result;
 else update public.quiz_teams set name=trim(p_data->>'name'),color=p_data->>'color',capacity=(p_data->>'capacity')::integer where id=target and event_id=e.id and (p_data->>'capacity')::integer >= (select count(*) from public.quiz_participants where team_id=target); if not found then raise exception 'Team missing or capacity below membership'; end if;
 end if;
 elsif p_action='round' then
 if target is null then insert into public.quiz_rounds(event_id,name,points,position) values(e.id,trim(p_data->>'name'),(p_data->>'points')::integer,(p_data->>'position')::integer) returning id into result;
 else update public.quiz_rounds set name=trim(p_data->>'name'),points=(p_data->>'points')::integer,position=(p_data->>'position')::integer where id=target and event_id=e.id; end if;
 elsif p_action='question' then
 if exists(select 1 from public.quiz_questions where id=target and published) then raise exception 'Published questions cannot be edited'; end if;
 if target is null then
 insert into public.quiz_questions(event_id,round_id,prompt,kind,options,answer_key,position) values(e.id,(p_data->>'round_id')::uuid,trim(p_data->>'prompt'),p_data->>'kind',p_data->'options',trim(p_data->>'answer_key'),(p_data->>'position')::integer) returning id into result;
 else update public.quiz_questions set round_id=(p_data->>'round_id')::uuid,prompt=trim(p_data->>'prompt'),kind=p_data->>'kind',options=p_data->'options',answer_key=trim(p_data->>'answer_key'),position=(p_data->>'position')::integer where id=target and event_id=e.id; end if;
 elsif p_action='delete_team' then delete from public.quiz_teams where id=target and event_id=e.id;
 elsif p_action='delete_round' then delete from public.quiz_rounds where id=target and event_id=e.id;
 elsif p_action='delete_question' then delete from public.quiz_questions where id=target and event_id=e.id and not published;
 end if;
 elsif p_action='assign' then
 if e.status<>'lobby' then raise exception 'Assign before starting'; end if;
 if not exists(select 1 from public.quiz_teams t where t.id=(p_data->>'team_id')::uuid and t.event_id=e.id and (select count(*) from public.quiz_participants where team_id=t.id)<t.capacity) then raise exception 'Team unavailable or full'; end if;
 update public.quiz_participants set team_id=(p_data->>'team_id')::uuid,captain=false where id=target and event_id=e.id;
 elsif p_action='captain' then
 if not exists(select 1 from public.quiz_participants where id=target and event_id=e.id) then raise exception 'Participant not found'; end if;
 update public.quiz_participants set captain=false where team_id=(select team_id from public.quiz_participants where id=target);
 update public.quiz_participants set captain=true where id=target;
 elsif p_action='evaluate' then
 if p_data->>'verdict' not in ('correct','wrong') or p_data->>'verdict' is null then raise exception 'Invalid verdict'; end if;
 select * into s from public.quiz_submissions where id=target and event_id=e.id for update;
 if s.id is null or s.verdict<>'pending' then raise exception 'Submission already evaluated or missing'; end if;
 update public.quiz_submissions set verdict=p_data->>'verdict' where id=s.id;
 if p_data->>'verdict'='correct' then
 select r.points into pts from public.quiz_questions x join public.quiz_rounds r on r.id=x.round_id where x.id=s.question_id;
 insert into public.quiz_scores(event_id,team_id,submission_id,points,reason,actor) values(e.id,s.team_id,s.id,pts,'Correct answer after review',auth.uid());
 end if;
 elsif p_action='adjust' then
 insert into public.quiz_scores(event_id,team_id,points,reason,actor) values(e.id,(p_data->>'team_id')::uuid,(p_data->>'points')::integer,trim(p_data->>'reason'),auth.uid());
 elsif p_action <> 'create_event' then raise exception 'Unknown operation';
 end if;
 insert into public.quiz_audit(event_id,actor,action,detail) values(e.id,auth.uid(),p_action,p_data);
 insert into public.quiz_signal values(e.id,clock_timestamp()) on conflict(event_id) do update set updated_at=excluded.updated_at;
 return result;
end $$;
revoke all on function public.quiz_state(uuid),public.quiz_join(text,text,uuid),public.quiz_submit(uuid,uuid,text),public.quiz_admin_state(uuid),public.quiz_admin(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.quiz_state(uuid) to anon,authenticated;
grant execute on function public.quiz_join(text,text,uuid),public.quiz_submit(uuid,uuid,text),public.quiz_admin_state(uuid),public.quiz_admin(text,uuid,jsonb) to authenticated;

create function public.quiz_my_event() returns uuid language sql stable security definer set search_path='' as $$
 select p.event_id from public.quiz_participants p join public.quiz_events e on e.id=p.event_id where p.user_id=auth.uid() order by e.created_at desc limit 1;
$$;
revoke all on function public.quiz_my_event() from public,anon;
grant execute on function public.quiz_my_event() to authenticated;

-- Official history is append-only, including against accidental privileged SQL updates.
create function public.quiz_history_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Quiz scoring and audit history are append-only; insert a correction with a reason'; end $$;
revoke all on function public.quiz_history_immutable() from public,anon,authenticated;
create trigger quiz_scores_immutable before update or delete or truncate on public.quiz_scores for each statement execute function public.quiz_history_immutable();
create trigger quiz_audit_immutable before update or delete or truncate on public.quiz_audit for each statement execute function public.quiz_history_immutable();
