-- Preserve a usable approved cover whenever staff accepts an AI candidate.
-- A photo moved to moderation cannot remain the only approved cover.
create or replace function public.cv_photo_accept_ai_version(p_version_id uuid,p_reviewer_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v record; ph record; ofs record; replacement_cover uuid;
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
  -- Repair the cover, using an already-approved official branded image only.
  if not exists(select 1 from public.cv_offer_photos
      where offer_id=ph.offer_id and state='approved' and is_cover=true) then
    select id into replacement_cover from public.cv_offer_photos
    where offer_id=ph.offer_id and id<>ph.id
      and state='approved' and logo_applied=true and logo_version='carvelo-v1'
    order by (case when photo_type='exterior' then 0 else 1 end),sort_order,created_at
    limit 1 for update;
    if replacement_cover is not null then
      update public.cv_offer_photos set is_cover=true where id=replacement_cover;
    end if;
  end if;
  update public.cv_photo_versions
  set qa_status='approved',reviewed_at=now(),reviewed_by=p_reviewer_id where id=v.id;
  update public.cv_photo_jobs set state='completed'
    where result_version_id=v.id and state='review';
  return jsonb_build_object('photo_id',v.photo_id,'review_status','review',
        'mode',v.mode,'window_view_changed',v.window_view_changed,
        'fallback_cover_id',replacement_cover);
end $$;
revoke all on function public.cv_photo_accept_ai_version(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.cv_photo_accept_ai_version(uuid,uuid) to service_role;

-- Repair the missing Omoda 5 cover without approving/replacing any pending image.
-- Do not touch offer status.
with valid_cover as (
 select p.id from public.cv_offer_photos p
 where p.offer_id='8e5ff6cb-8490-4849-82c1-5ffd7e0754bb'::uuid
  and p.state='approved' and p.photo_type='exterior'
  and p.logo_applied=true and p.logo_version='carvelo-v1'
  and not exists (
    select 1 from public.cv_offer_photos c
    where c.offer_id=p.offer_id and c.is_cover and c.state='approved'
  )
 order by p.sort_order limit 1
)
update public.cv_offer_photos set is_cover=true where id in (select id from valid_cover);
