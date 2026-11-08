-- Worker must receive staff-selected window polygons as well as photo metadata.
create or replace function public.cv_ai_claim(p_run_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m record; j record; payload jsonb;
begin
 if length(p_run_id) not between 5 and 32 or p_run_id !~ '^[0-9]+$'
 then raise exception 'invalid_worker_run_id'; end if;
 select * into m from pgmq.read('carvelo_photo_ai',1200,1) limit 1;
 if not found then return null; end if;
 select * into j from public.cv_photo_jobs where id=(m.message->>'job_id')::uuid for update;
 if not found or j.state not in ('queued','processing') then
   perform pgmq.archive('carvelo_photo_ai',m.msg_id); return null;
 end if;
 if j.attempts >= 3 then
   update public.cv_photo_jobs set state='failed',error_code='attempts_exhausted',finished_at=now()
   where id=j.id;
   perform pgmq.archive('carvelo_photo_ai',m.msg_id); return null;
 end if;
 select jsonb_build_object('job_id',j.id,'photo_id',ph.id,'offer_id',ph.offer_id,
   'original_path',ph.original_path,'photo_type',ph.photo_type,
   'target_mode',j.target_mode,'attempt',j.attempts+1,
   'window_polygons',j.window_polygons)
 into payload from public.cv_offer_photos ph
 join public.cv_offers o on o.id=ph.offer_id
 where ph.id=j.photo_id and o.status <> 'published' and ph.state <> 'rejected'
 and ((j.target_mode='showroom_exterior' and ph.photo_type='exterior')
   or (j.target_mode='showroom_windows' and ph.photo_type='interior'));
 if payload is null then
   update public.cv_photo_jobs set state='failed',error_code='ineligible_photo',finished_at=now()
   where id=j.id;
   perform pgmq.archive('carvelo_photo_ai',m.msg_id); return null;
 end if;
 update public.cv_photo_jobs set state='processing',attempts=attempts+1,
   worker_run_id=p_run_id,started_at=now(),
   provider=case when j.target_mode='showroom_windows' then
          case when j.window_polygons is not null then 'github_oidc_manual_window_mask'
               else 'github_oidc_clipseg' end else 'github_oidc_u2net' end
 where id=j.id;
 return payload;
end $$;
revoke all on function public.cv_ai_claim(text) from public,anon,authenticated;
grant execute on function public.cv_ai_claim(text) to service_role;
