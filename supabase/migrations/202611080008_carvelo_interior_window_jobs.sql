-- CARVELO interior window background beta. All AI candidates remain private and require staff approval.
insert into public.cv_photo_styles (code,title,image_path,logo_version,is_active)
values ('windows-v1','Widok za szybami samochodu — CARVELO (BETA)',null,'carvelo-v1',false)
on conflict (code) do nothing;

create or replace function public.cv_ai_claim(p_run_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m record; j record; v jsonb;
begin
 if length(p_run_id) not between 5 and 32 or p_run_id !~ '^[0-9]+$' then
   raise exception 'invalid_worker_run_id';
 end if;
 select * into m from pgmq.read('carvelo_photo_ai',1200,1) limit 1;
 if not found then return null; end if;
 select * into j from public.cv_photo_jobs where id=(m.message->>'job_id')::uuid for update;
 if not found or j.state not in ('queued','processing') then
   perform pgmq.archive('carvelo_photo_ai',m.msg_id);
   return null;
 end if;
 if j.attempts>=3 then
   update public.cv_photo_jobs set state='failed',error_code='attempts_exhausted',finished_at=now()
   where id=j.id;
   perform pgmq.archive('carvelo_photo_ai',m.msg_id);
   return null;
 end if;
 select jsonb_build_object('job_id',j.id,'photo_id',ph.id,'offer_id',ph.offer_id,
   'original_path',ph.original_path,'photo_type',ph.photo_type,'target_mode',j.target_mode,'attempt',j.attempts+1)
 into v from public.cv_offer_photos ph join public.cv_offers o on o.id=ph.offer_id
 where ph.id=j.photo_id and o.status<>'published' and ph.state<>'rejected'
 and ((j.target_mode='showroom_exterior' and ph.photo_type='exterior')
   or (j.target_mode='showroom_windows' and ph.photo_type='interior'));
 if v is null then
   update public.cv_photo_jobs set state='failed',error_code='ineligible_photo',finished_at=now()
   where id=j.id;
   perform pgmq.archive('carvelo_photo_ai',m.msg_id);
   return null;
 end if;
 update public.cv_photo_jobs
   set state='processing',attempts=attempts+1,worker_run_id=p_run_id,started_at=now(),
   provider=case when j.target_mode='showroom_windows' then 'github_oidc_clipseg'
                 else 'github_oidc_u2net' end
 where id=j.id;
 return v;
end $$;
revoke all on function public.cv_ai_claim(text) from public,anon,authenticated;
grant execute on function public.cv_ai_claim(text) to service_role;

create or replace function public.cv_ai_complete(p_job uuid,p_run_id text,p_result_path text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j record; v_id uuid; 
begin
 select * into j from public.cv_photo_jobs where id=p_job for update;
 if not found or j.state<>'processing' or j.worker_run_id is distinct from p_run_id
 then raise exception 'invalid_or_expired_worker_claim'; end if;
 if j.target_mode not in ('showroom_exterior','showroom_windows')
 then raise exception 'invalid_ai_mode'; end if;
 if p_result_path !~ '^[a-f0-9-]+/[a-f0-9-]+/ai/[a-f0-9-]+[.]png$'
 then raise exception 'invalid_result_path'; end if;
 if not exists (
   select 1 from public.cv_offer_photos ph
   join public.cv_offers o on o.id=ph.offer_id
   where ph.id=j.photo_id and o.status<>'published'
   and p_result_path like ph.offer_id::text||'/'||ph.id::text||'/ai/%'
   and ((j.target_mode='showroom_windows' and ph.photo_type='interior') or 
        (j.target_mode='showroom_exterior' and ph.photo_type='exterior'))
 ) then raise exception 'wrong_photo_or_published_offer'; end if;
 insert into public.cv_photo_versions
 (photo_id,result_path,mode,logo_version,logo_applied,qa_status,original_pixels_preserved,scene_version)
 values (j.photo_id,p_result_path,j.target_mode,'carvelo-v1',true,'review',true,'showroom-v1')
 returning id into v_id;
 update public.cv_photo_jobs set state='review',result_version_id=v_id,finished_at=now(),error_code=null
 where id=p_job;
 perform pgmq.archive('carvelo_photo_ai',j.queue_message_id);
 return jsonb_build_object('job_id',j.id,'version_id',v_id,'state','review','mode',j.target_mode);
end $$;
revoke all on function public.cv_ai_complete(uuid,text,text) from public,anon,authenticated;
grant execute on function public.cv_ai_complete(uuid,text,text) to service_role;

-- Candidate acceptance remains exclusively server-mediated; existing moderation is unchanged.
