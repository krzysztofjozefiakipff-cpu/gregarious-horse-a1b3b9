-- CARVELO glass-only interior composite, strict opt-in and manual moderation.
alter table public.cv_photo_versions
  add column if not exists window_view_changed boolean,
  add column if not exists review_required_reason text;

comment on column public.cv_photo_versions.window_view_changed is
'False for conservative fallback: original interior photo remains unchanged except for the official logo.';
comment on column public.cv_photo_versions.review_required_reason is
'When mask fails QA, retain original scenery and mark reason for staff review.';

-- New RPC, avoids overloading the existing 3-parameter exterior completion endpoint.
create or replace function public.cv_ai_complete_v2(
  p_job uuid,p_run_id text,p_result_path text,p_window_changed boolean,
  p_mask_confidence numeric,p_review_reason text
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j record; v_id uuid; candidate_mode text; previous record;
begin
  select * into j from public.cv_photo_jobs where id=p_job for update;
  if not found or j.state <> 'processing' or j.worker_run_id is distinct from p_run_id
  then raise exception 'invalid_or_expired_worker_claim'; end if;
  if j.target_mode not in ('showroom_exterior','showroom_windows')
  then raise exception 'invalid_ai_mode'; end if;
  if p_result_path !~ '^[a-f0-9-]+/[a-f0-9-]+/ai/[a-f0-9-]+[.]png$'
  then raise exception 'invalid_result_path'; end if;
  if p_mask_confidence is not null and (p_mask_confidence<0 or p_mask_confidence>1)
  then raise exception 'invalid_mask_confidence'; end if;
  if j.target_mode = 'showroom_exterior' and (p_window_changed is not null or p_review_reason is not null)
  then raise exception 'invalid_exterior_metadata'; end if;
  if j.target_mode = 'showroom_windows' and p_window_changed is null
  then raise exception 'missing_windows_qa'; end if;
  if j.target_mode = 'showroom_windows' and p_window_changed = false
     and coalesce(length(p_review_reason),0)=0
  then raise exception 'fallback_requires_reason'; end if;

  select ph.*,o.status as offer_status into previous
  from public.cv_offer_photos ph join public.cv_offers o on o.id=ph.offer_id
  where ph.id=j.photo_id for share of ph;
  if not found or previous.offer_status='published'
     or previous.state='rejected' or
     (j.target_mode='showroom_windows' and previous.photo_type<>'interior') or
     (j.target_mode='showroom_exterior' and previous.photo_type<>'exterior') or
     p_result_path not like previous.offer_id::text||'/'||previous.id::text||'/ai/%'
  then raise exception 'not_eligible_for_ai_completion'; end if;

  insert into public.cv_photo_versions
   (photo_id,result_path,mode,logo_version,logo_applied,qa_status,original_pixels_preserved,
    scene_version,mask_confidence,window_view_changed,review_required_reason)
  values (j.photo_id,p_result_path,j.target_mode,'carvelo-v1',true,'review',true,
    'showroom-v1',p_mask_confidence,p_window_changed,left(p_review_reason,120))
  returning id into v_id;
  update public.cv_photo_jobs
  set state='review',result_version_id=v_id,finished_at=now(),error_code=null
  where id=j.id;
  perform pgmq.archive('carvelo_photo_ai',j.queue_message_id);
  return jsonb_build_object('job_id',j.id,'version_id',v_id,'state','review',
    'changed',p_window_changed,'mode',j.target_mode);
end $$;

revoke all on function public.cv_ai_complete_v2(uuid,text,text,boolean,numeric,text)
 from public,anon,authenticated;
grant execute on function public.cv_ai_complete_v2(uuid,text,text,boolean,numeric,text) to service_role;

-- Fix regex in the older approval path: no text regex escaping ambiguity.
create or replace function public.cv_photo_accept_ai_version(p_version_id uuid,p_reviewer_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v record; ph record; ofs record;
begin
  select * into v from public.cv_photo_versions where id=p_version_id for update;
  if not found or v.qa_status<>'review' or not v.logo_applied or v.logo_version<>'carvelo-v1'
     or v.result_path !~ '^[a-f0-9-]+/[a-f0-9-]+/ai/[a-f0-9-]+[.]png$'
  then raise exception 'Candidate not ready or missing official watermark'; end if;
  select * into ph from public.cv_offer_photos where id=v.photo_id for update;
  if not found then raise exception 'Photo does not exist'; end if;
  select * into ofs from public.cv_offers where id=ph.offer_id for update;
  if not found or ofs.status='published'
  then raise exception 'Unpublish the offer before replacing a photo'; end if;
  if not exists (select 1 from public.cv_profiles p
    where p.id=p_reviewer_id and p.role in ('admin','staff') and p.enabled=true)
  then raise exception 'Reviewer must be an active CARVELO member'; end if;
  update public.cv_offer_photos
  set processed_path=v.result_path,background_mode=case when v.mode='showroom_windows' and
      v.window_view_changed=false then 'original' else 'showroom' end,
      logo_applied=true,logo_version='carvelo-v1',state='review',is_cover=false,
      reviewed_by=null,reviewed_at=null where id=v.photo_id;
  update public.cv_photo_versions
  set qa_status='approved',reviewed_at=now(),reviewed_by=p_reviewer_id where id=v.id;
  update public.cv_photo_jobs set state='completed'
    where result_version_id=v.id and state='review';
  return jsonb_build_object('photo_id',v.photo_id,'review_status','review',
        'mode',v.mode,'window_view_changed',v.window_view_changed);
end $$;
revoke all on function public.cv_photo_accept_ai_version(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.cv_photo_accept_ai_version(uuid,uuid) to service_role;
