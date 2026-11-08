-- Validate the completion path with a literal dot, not a double-escaped regexp.
create or replace function public.cv_ai_complete(p_job uuid,p_run_id text,p_result_path text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare j record; v_id uuid;
begin
 select * into j from public.cv_photo_jobs where id=p_job for update;
 if not found or j.state<>'processing' or j.worker_run_id is distinct from p_run_id
 then raise exception 'invalid_or_expired_worker_claim'; end if;
 if p_result_path !~ '^[a-f0-9-]+/[a-f0-9-]+/ai/[a-f0-9-]+[.]png$' then
   raise exception 'invalid_result_path'; end if;
 if not exists (select 1 from public.cv_offer_photos ph where ph.id=j.photo_id
    and p_result_path like ph.offer_id::text||'/'||ph.id::text||'/ai/%') then
   raise exception 'wrong_photo_storage_prefix'; end if;
 insert into public.cv_photo_versions
   (photo_id,result_path,mode,logo_version,logo_applied,qa_status,original_pixels_preserved,scene_version)
 values (j.photo_id,p_result_path,'showroom_exterior','carvelo-v1',true,'review',true,'showroom-v1')
 returning id into v_id;
 update public.cv_photo_jobs
   set state='review',result_version_id=v_id,finished_at=now(),error_code=null where id=p_job;
 perform pgmq.archive('carvelo_photo_ai',j.queue_message_id);
 return jsonb_build_object('job_id',j.id,'version_id',v_id,'state','review');
end $$;
revoke all on function public.cv_ai_complete(uuid,text,text) from public,anon,authenticated;
grant execute on function public.cv_ai_complete(uuid,text,text) to service_role;