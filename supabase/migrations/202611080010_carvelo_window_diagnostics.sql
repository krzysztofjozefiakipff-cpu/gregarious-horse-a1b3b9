-- Model diagnostics contain coverage only, never images or PII.
create or replace function public.cv_ai_fail(p_job uuid,p_run_id text,p_code text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j record; terminal boolean; code text;
begin
 select * into j from public.cv_photo_jobs where id=p_job for update;
 if not found or j.state<>'processing' or j.worker_run_id is distinct from p_run_id
 then raise exception 'invalid_or_expired_worker_claim'; end if;
 code=left(coalesce(p_code,'worker_failed'),120);
 terminal:=j.attempts>=3 or code like 'window_mask_uncertain%'
   or code like 'window_core_not_safe%'
   or code in ('window_mask_reaches_interior','window_no_visible_view',
              'mask_quality_unreliable','mask_size_mismatch','mask_not_finite');
 update public.cv_photo_jobs
 set state=case when terminal then 'failed' else 'queued' end,
 error_code=code,
 finished_at=case when terminal then now() else null end where id=j.id;
 if terminal then perform pgmq.archive('carvelo_photo_ai',j.queue_message_id); end if;
 return jsonb_build_object('state',case when terminal then 'failed' else 'queued' end);
end $$;
revoke all on function public.cv_ai_fail(uuid,text,text) from public,anon,authenticated;
grant execute on function public.cv_ai_fail(uuid,text,text) to service_role;