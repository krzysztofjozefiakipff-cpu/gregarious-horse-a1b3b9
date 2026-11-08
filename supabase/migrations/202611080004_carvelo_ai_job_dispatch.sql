-- Enqueue only server-created photo jobs. Authenticated browser roles cannot INSERT jobs.
create function carvelo_private.queue_photo_ai_job()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.state='queued' then
    new.queue_message_id := pgmq.send('carvelo_photo_ai',
      jsonb_build_object('job_id',new.id,'photo_id',new.photo_id,'mode',new.target_mode));
  end if;
  return new;
end $$;
revoke all on function carvelo_private.queue_photo_ai_job() from public,anon,authenticated;
create trigger cv_photo_enqueue
before insert on public.cv_photo_jobs
for each row execute function carvelo_private.queue_photo_ai_job();
