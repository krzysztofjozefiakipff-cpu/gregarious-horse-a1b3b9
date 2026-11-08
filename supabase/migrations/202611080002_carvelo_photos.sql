-- CARVELO: private vehicle photo storage and server-enforced publication requirements.
-- Photo rows and branded images are written only by the authenticated Edge Function.
create table public.cv_offer_photos (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.cv_offers(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  original_path text not null unique,
  processed_path text not null unique,
  photo_type text not null default 'unknown'
    check (photo_type in ('exterior','interior','detail','unknown')),
  background_mode text not null default 'original'
    check (background_mode in ('original','showroom')),
  logo_version text not null default 'carvelo-v1',
  logo_applied boolean not null default true,
  state text not null default 'review'
    check (state in ('review','approved','rejected')),
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  constraint cv_photo_approved_has_logo check (state <> 'approved' or (logo_applied and processed_path <> ''))
);
create index cv_offer_photos_offer_state_idx on public.cv_offer_photos(offer_id,state,sort_order);
create unique index cv_photo_single_cover on public.cv_offer_photos(offer_id)
  where is_cover and state = 'approved';

alter table public.cv_offer_photos enable row level security;
revoke all on public.cv_offer_photos from anon,authenticated;
grant select on public.cv_offer_photos to anon,authenticated;

create policy cv_photo_anon_approved on public.cv_offer_photos
  for select to anon using (
    state='approved' and exists (select 1 from public.cv_offers o
       where o.id=offer_id and o.status='published')
  );
create policy cv_photo_auth_read on public.cv_offer_photos
  for select to authenticated using (
    (state='approved' and exists (select 1 from public.cv_offers o
       where o.id=offer_id and o.status='published'))
    or (select carvelo_private.current_role()) in ('admin','staff')
    or (select carvelo_private.current_role())='dealer' and exists
      (select 1 from public.cv_offers o where o.id=offer_id
        and o.dealer_id=(select carvelo_private.current_dealer()))
  );

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('carvelo-photo-originals','carvelo-photo-originals',false,5242880,array['image/jpeg','image/png','image/webp']),
       ('carvelo-photo-branded','carvelo-photo-branded',false,12582912,array['image/png'])
on conflict (id) do nothing;

-- No direct client upload/write policies: only the server-side function with privileged keys may write.
-- For public published pictures: temporary signed URLs are possible but originals remain inaccessible.
create policy cv_branded_signed_select on storage.objects
 for select to anon,authenticated
 using (
   bucket_id='carvelo-photo-branded'
   and exists (
     select 1 from public.cv_offer_photos ph
     join public.cv_offers o on o.id=ph.offer_id
     where ph.processed_path=storage.objects.name and ph.state='approved'
       and o.status='published'
   )
 );

-- Internal users can obtain short-lived previews from the same private bucket,
-- without ever being able to read originals or write any object directly.
create policy cv_branded_staff_select on storage.objects
 for select to authenticated
 using (
   bucket_id='carvelo-photo-branded'
   and (select carvelo_private.current_role()) in ('admin','staff')
 );
create policy cv_branded_dealer_preview on storage.objects
 for select to authenticated
 using (
   bucket_id='carvelo-photo-branded'
   and (select carvelo_private.current_role())='dealer'
   and exists (
     select 1 from public.cv_offer_photos ph
     join public.cv_offers o on o.id=ph.offer_id
     where ph.processed_path=storage.objects.name
       and o.dealer_id=(select carvelo_private.current_dealer())
   )
 );

-- The gate operates at database level even if an admin calls PostgREST directly.
create function carvelo_private.enforce_cover_before_publish()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' and (tg_op='INSERT' or old.status is distinct from 'published') then
  if not exists (
    select 1 from public.cv_offer_photos p
    where p.offer_id=new.id and p.state='approved'
      and p.is_cover and p.logo_applied and p.processed_path <> ''
  ) then
    raise exception 'CARVELO: przed publikacją zatwierdź zdjęcie główne z logo'
      using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function carvelo_private.enforce_cover_before_publish() from public,anon,authenticated;
create trigger cv_require_branded_cover
before insert or update of status on public.cv_offers
for each row execute function carvelo_private.enforce_cover_before_publish();

comment on table public.cv_offer_photos is
  'CARVELO server-created branded photos. Original files are never public. Only approved and published photos are visible to visitors.';