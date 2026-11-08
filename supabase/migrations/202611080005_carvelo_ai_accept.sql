-- Atomic AI review: only a trusted backend service may switch a branded AI version into moderation.
create function public.cv_photo_accept_ai_version(p_version_id uuid,p_reviewer_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v record; ph record; ofs record; 
begin
 select * into v from public.cv_photo_versions where id=p_version_id for update;
 if not found or v.qa_status<>'review' or not v.logo_applied or v.logo_version<>'carvelo-v1'
   or v.result_path !~ '^[a-f0-9-]+/[a-f0-9-]+/ai/[a-f0-9-]+\.png$'
 then raise exception 'Candidate not ready or missing official watermark'; end if;
 select * into ph from public.cv_offer_photos where id=v.photo_id for update;
 if not found then raise exception 'Photo does not exist'; end if;
 select * into ofs from public.cv_offers where id=ph.offer_id for update;
 if not found or ofs.status='published' then
   raise exception 'Unpublish the offer before replacing a photo'; end if;
 if not exists (select 1 from public.cv_profiles p
   where p.id=p_reviewer_id and p.role in ('admin','staff') and p.enabled=true)
 then raise exception 'Reviewer must be an active CARVELO member'; end if;
 update public.cv_offer_photos
 set processed_path=v.result_path,background_mode='showroom',logo_applied=true,
     logo_version='carvelo-v1',state='review',is_cover=false,
     reviewed_by=null,reviewed_at=null
 where id=v.photo_id;
 update public.cv_photo_versions
 set qa_status='approved',reviewed_at=now(),reviewed_by=p_reviewer_id
 where id=v.id;
 update public.cv_photo_jobs set state='completed' where result_version_id=v.id and state='review';
 return jsonb_build_object('photo_id',v.photo_id,'review_status','review','background_mode','showroom');
end $$;
revoke all on function public.cv_photo_accept_ai_version(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cv_photo_accept_ai_version(uuid,uuid) to service_role;
