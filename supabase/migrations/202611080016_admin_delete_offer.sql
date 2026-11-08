-- CARVELO permanent offer deletion with private media cleanup journal.
-- Only an enabled ADMIN, via service-role Edge Function, can delete an offer.
-- Processing jobs block deletion; queued jobs are archived before removal.
create table if not exists public.cv_offer_cleanup_batches (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null,
  actor_id uuid not null references auth.users(id),
  original_paths text[] not null default '{}',
  branded_paths text[] not null default '{}',
  state text not null default 'pending' check(state in ('pending','done','failed')),
  last_error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.cv_offer_cleanup_batches enable row level security;
revoke all on public.cv_offer_cleanup_batches from anon,authenticated;
grant select,insert,update on public.cv_offer_cleanup_batches to service_role;

create or replace function public.cv_delete_offer_admin(
  p_offer_id uuid,p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare batch uuid; original_paths text[]; branded_paths text[];
begin
  if not exists (
    select 1 from public.cv_profiles
    where id=p_actor_id and enabled and role='admin'
  ) then raise exception 'only_enabled_admin_can_delete_offers'; end if;
  perform 1 from public.cv_offers where id=p_offer_id for update;
  if not found then raise exception 'offer_not_found'; end if;
  if exists (
    select 1 from public.cv_photo_jobs j join public.cv_offer_photos p on p.id=j.photo_id
    where p.offer_id=p_offer_id and j.state='processing'
  ) then raise exception 'offer_ai_processing_busy'; end if;

  -- Archive queued and already-invisible jobs before removing their database records.
  perform pgmq.archive('carvelo_photo_ai',j.queue_message_id)
    from public.cv_photo_jobs j
    join public.cv_offer_photos p on p.id=j.photo_id
    where p.offer_id=p_offer_id and j.queue_message_id is not null
      and j.state in ('queued','processing');

  select coalesce(array_agg(name),array[]::text[]) into original_paths
    from storage.objects where bucket_id='carvelo-photo-originals'
      and name like p_offer_id::text||'/%';
  select coalesce(array_agg(name),array[]::text[]) into branded_paths
    from storage.objects where bucket_id='carvelo-photo-branded'
      and name like p_offer_id::text||'/%';

  insert into public.cv_offer_cleanup_batches(offer_id,actor_id,original_paths,branded_paths)
  values(p_offer_id,p_actor_id,original_paths,branded_paths) returning id into batch;

  -- Delete explicit child relations in FK-safe order; do not rely on CASCADE order
  -- between photo jobs and photo versions.
  delete from public.cv_photo_jobs where photo_id in
    (select id from public.cv_offer_photos where offer_id=p_offer_id);
  delete from public.cv_photo_versions where photo_id in
    (select id from public.cv_offer_photos where offer_id=p_offer_id);
  delete from public.cv_offer_photos where offer_id=p_offer_id;
  delete from public.cv_offers where id=p_offer_id;

  return jsonb_build_object('batch_id',batch,'original_paths',original_paths,
                            'branded_paths',branded_paths);
end $$;

revoke all on function public.cv_delete_offer_admin(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cv_delete_offer_admin(uuid,uuid) to service_role;
