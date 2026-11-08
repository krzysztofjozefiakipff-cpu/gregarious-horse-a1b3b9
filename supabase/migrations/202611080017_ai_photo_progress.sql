-- CARVELO: auditable milestone progress, never a fabricated timer-derived percentage.
alter table public.cv_photo_jobs
  add column if not exists progress_percent smallint not null default 0
    check(progress_percent between 0 and 100),
  add column if not exists progress_stage text not null default 'queued',
  add column if not exists progress_at timestamptz;

create or replace function carvelo_private.cv_ai_progress_state_stamp()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.state='processing' then
    new.progress_percent:=greatest(new.progress_percent,10);
    new.progress_stage:='preparing';
  elsif new.state in ('review','completed') then
    new.progress_percent:=100;
    new.progress_stage:=new.state;
  elsif new.state='failed' then
    new.progress_stage:='failed';
  elsif new.state='cancelled' then
    new.progress_stage:='cancelled';
  elsif new.state='queued' then
    new.progress_percent:=0;
    new.progress_stage:='queued';
  end if;
  new.progress_at:=now();
  return new;
end $$;
drop trigger if exists cv_ai_progress_state on public.cv_photo_jobs;
create trigger cv_ai_progress_state
before update of state on public.cv_photo_jobs
for each row when(old.state is distinct from new.state)
execute function carvelo_private.cv_ai_progress_state_stamp();

create or replace function public.cv_ai_report_progress(
  p_job uuid,p_run_id text,p_percent integer,p_stage text
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j record;
begin
  if p_percent not between 10 and 95 or p_stage not in (
    'preparing','installing','loading_model','downloading',
    'segmenting','compositing','branding','uploading')
  then raise exception 'invalid_progress_update'; end if;
  select state,worker_run_id,progress_percent into j
  from public.cv_photo_jobs where id=p_job for update;
  if not found or j.state<>'processing' or j.worker_run_id is distinct from p_run_id
  then raise exception 'invalid_worker_progress_claim'; end if;
  if p_percent<j.progress_percent then
    return jsonb_build_object('ok',true,'stale',true,'percent',j.progress_percent);
  end if;
  update public.cv_photo_jobs set progress_percent=p_percent,
    progress_stage=p_stage,progress_at=now() where id=p_job;
  return jsonb_build_object('ok',true,'percent',p_percent,'stage',p_stage);
end $$;
revoke all on function public.cv_ai_report_progress(uuid,text,integer,text)
  from public,anon,authenticated;
grant execute on function public.cv_ai_report_progress(uuid,text,integer,text)
  to service_role;

-- Backfill only; existing finished jobs are marked 100%, not replayed.
update public.cv_photo_jobs
set progress_percent=case
  when state in ('completed','review') then 100
  when state='processing' then 10
  else 0 end,
  progress_stage=case
  when state in ('completed','review','failed','cancelled') then state
  when state='processing' then 'preparing'
  else 'queued' end,
  progress_at=coalesce(finished_at,started_at,created_at)
where progress_at is null;
