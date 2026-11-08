-- CARVELO automatic visual background replacement v1 foundations.
-- Standalone AI workers consume pgmq messages. This migration never modifies existing photos.
create schema if not exists pgmq;
create extension if not exists pgmq with schema pgmq;
select pgmq.create('carvelo_photo_ai');

create table public.cv_photo_versions (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.cv_offer_photos(id) on delete cascade,
  result_path text not null,
  thumbnail_path text,
  scene_version text not null default 'showroom-v1',
  mode text not null check(mode in ('original','showroom_exterior','showroom_windows')),
  logo_version text not null default 'carvelo-v1',
  logo_applied boolean not null default false,
  qa_status text not null default 'pending' check(qa_status in ('pending','review','approved','rejected','failed')),
  mask_confidence numeric(5,4) check(mask_confidence is null or mask_confidence between 0 and 1),
  original_pixels_preserved boolean not null default false,
  error_code text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique(photo_id,result_path)
);
create index cv_photo_versions_photo_idx on public.cv_photo_versions(photo_id,created_at desc);
alter table public.cv_photo_versions enable row level security;
revoke all on table public.cv_photo_versions from anon, authenticated;
grant select on table public.cv_photo_versions to authenticated;
create policy cv_photo_versions_read on public.cv_photo_versions
for select to authenticated using (
  exists (
    select 1 from public.cv_offer_photos p
    where p.id=photo_id
  )
);

create table public.cv_photo_jobs (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.cv_offer_photos(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  target_mode text not null check (target_mode in ('showroom_exterior','showroom_windows','original')),
  state text not null default 'queued'
    check(state in ('queued','processing','review','completed','failed','cancelled')),
  attempts smallint not null default 0 check(attempts between 0 and 3),
  provider text not null default 'not_configured',
  queue_message_id bigint,
  error_code text,
  result_version_id uuid references public.cv_photo_versions(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create unique index cv_photo_jobs_one_active
on public.cv_photo_jobs(photo_id)
where state in ('queued','processing');
create index cv_photo_jobs_photo_created on public.cv_photo_jobs(photo_id,created_at desc);
alter table public.cv_photo_jobs enable row level security;
revoke all on table public.cv_photo_jobs from anon,authenticated;
grant select on table public.cv_photo_jobs to authenticated;
create policy cv_photo_jobs_read on public.cv_photo_jobs
for select to authenticated using (
  exists (select 1 from public.cv_offer_photos p where p.id=photo_id)
);

-- Canonical brand reference; this is metadata, not the asset itself.
create table public.cv_photo_styles (
  code text primary key,
  title text not null,
  image_path text,
  logo_version text not null default 'carvelo-v1',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.cv_photo_styles(code,title,image_path,is_active) values
('showroom-v1','Wirtualny salon CARVELO',null,false),
('original','Oryginalne tło',null,true);
alter table public.cv_photo_styles enable row level security;
revoke all on table public.cv_photo_styles from anon,authenticated;
grant select on table public.cv_photo_styles to authenticated;
create policy cv_photo_styles_read on public.cv_photo_styles
for select to authenticated using ((select carvelo_private.current_role()) in ('admin','staff','dealer'));

-- Data guards on publication: photo versions cannot be published without logo.
-- Legacy approved covers remain valid; new AI variants remain private pending review.
comment on table public.cv_photo_jobs is
'Durable background replacement jobs. Browser roles may read authorized progress but never submit completed AI results.';
comment on table public.cv_photo_versions is
'Immutable processing candidates; no image version may reach the public gallery without CARVELO approval and canonical watermark.';
