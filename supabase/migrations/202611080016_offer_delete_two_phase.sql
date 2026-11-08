-- CARVELO: irreversible offer deletion only after explicit admin confirmation.
-- Phase 1: freeze offer, cancel private queued jobs and archive pgmq messages.
-- Phase 2: Edge Function removes Storage objects using Storage API; only then deletes row.
alter table public.cv_offers
  add column if not exists deletion_pending boolean not null default false;

create or replace function public.cv_prepare_offer_delete(p_offer_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target record; job record; count_cancelled integer := 0;
begin
  select id,deletion_pending into target
  from public.cv_offers where id=p_offer_id for update;
  if not found then raise exception 'offer_not_found'; end if;
  if exists (
    select 1 from public.cv_photo_jobs j
    join public.cv_offer_photos ph on ph.id=j.photo_id
    where ph.offer_id=p_offer_id and j.state='processing'
  ) then
    raise exception 'ai_processing_in_progress';
  end if;
  update public.cv_offers set deletion_pending=true where id=p_offer_id;
  for job in
    select j.id,j.queue_message_id from public.cv_photo_jobs j
    join public.cv_offer_photos ph on ph.id=j.photo_id
    where ph.offer_id=p_offer_id and j.state='queued' for update of j
  loop
    update public.cv_photo_jobs
    set state='cancelled',finished_at=now(),error_code='offer_deletion'
    where id=job.id;
    if job.queue_message_id is not null then
      perform pgmq.archive('carvelo_photo_ai',job.queue_message_id);
    end if;
    count_cancelled := count_cancelled+1;
  end loop;
  return jsonb_build_object('offer_id',p_offer_id,'deletion_pending',true,
    'cancelled_jobs',count_cancelled);
end $$;
revoke all on function public.cv_prepare_offer_delete(uuid) from public,anon,authenticated;
grant execute on function public.cv_prepare_offer_delete(uuid) to service_role;

-- All incoming jobs lock their offer row and refuse an offer being deleted.
create or replace function carvelo_private.queue_photo_ai_job()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.state='queued' then
    perform 1 from public.cv_offers o join public.cv_offer_photos ph on ph.offer_id=o.id
    where ph.id=new.photo_id and o.deletion_pending=false for share of o;
    if not found then raise exception 'offer_pending_deletion'; end if;
    new.queue_message_id := pgmq.send('carvelo_photo_ai',
      jsonb_build_object('job_id',new.id,'photo_id',new.photo_id,'mode',new.target_mode));
  end if;
  return new;
end $$;
revoke all on function carvelo_private.queue_photo_ai_job() from public,anon,authenticated;

-- Fail-safe on queued messages created before a deletion was requested.
do $$
declare definition text;
begin
 definition := pg_get_functiondef('public.cv_ai_claim(text)'::regprocedure);
 if position('where ph.id=j.photo_id and ph.state <> ''rejected''' in definition)=0
 then raise exception 'cv_ai_claim_signature_changed'; end if;
 definition := replace(definition,
   'where ph.id=j.photo_id and ph.state <> ''rejected''',
   'where ph.id=j.photo_id and ph.state <> ''rejected'' and o.deletion_pending=false');
 execute definition;
end $$;
