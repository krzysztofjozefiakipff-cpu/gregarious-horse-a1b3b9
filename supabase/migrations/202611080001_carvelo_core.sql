-- CARVELO | initial protected backend (Supabase Postgres)
-- Run in Supabase SQL Editor on a new project. NEVER paste service_role keys into browser code.
-- Invited users start as unassigned and disabled; only an admin may enable/assign them.

create schema if not exists carvelo_private;
revoke all on schema carvelo_private from public;
grant usage on schema carvelo_private to authenticated;

create type public.cv_role as enum ('unassigned', 'admin', 'staff', 'dealer');
create type public.cv_offer_status as enum ('draft', 'pending', 'published', 'rejected');
create type public.cv_offer_source as enum ('carvelo', 'dealer');

create table public.cv_dealers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.cv_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role public.cv_role not null default 'unassigned',
  dealer_id uuid references public.cv_dealers(id),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint cv_dealer_assignment check (role <> 'dealer' or dealer_id is not null),
  constraint cv_unassigned_disabled check (role <> 'unassigned' or enabled = false)
);
create index cv_profiles_dealer_idx on public.cv_profiles(dealer_id);

create table public.cv_offers (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (char_length(btrim(brand)) between 1 and 70),
  model text not null check (char_length(btrim(model)) between 1 and 100),
  body text not null check (body in ('SUV','Sedan','Hatchback','Dostawczy')),
  fuel text not null check (fuel in ('Hybryda','Benzyna','Elektryczny','Diesel')),
  gross_price numeric(12,2) not null check (gross_price > 0 and gross_price < 100000000),
  dealer_id uuid not null references public.cv_dealers(id),
  status public.cv_offer_status not null default 'pending',
  source public.cv_offer_source not null default 'carvelo',
  special boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cv_offers_status_created_idx on public.cv_offers(status,created_at desc);
create index cv_offers_dealer_idx on public.cv_offers(dealer_id);
create index cv_offers_creator_idx on public.cv_offers(created_by);

-- These SECURITY DEFINER functions read profile rows without recursive RLS.
-- The functions read only the ID of the authenticated caller.
create function carvelo_private.current_role()
returns text language sql stable security definer
set search_path = ''
as $$
  select p.role::text from public.cv_profiles p
  where p.id = (select auth.uid()) and p.enabled = true
  limit 1
$$;
create function carvelo_private.current_dealer()
returns uuid language sql stable security definer
set search_path = ''
as $$
  select p.dealer_id from public.cv_profiles p
  where p.id = (select auth.uid()) and p.enabled = true and p.role = 'dealer'
  limit 1
$$;
revoke all on function carvelo_private.current_role() from public;
revoke all on function carvelo_private.current_dealer() from public;
grant execute on function carvelo_private.current_role() to authenticated;
grant execute on function carvelo_private.current_dealer() to authenticated;

-- Every invited Auth user gets an inactive profile; no role is trusted from user metadata.
create function carvelo_private.create_profile()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.cv_profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end
$$;
revoke all on function carvelo_private.create_profile() from public;
create trigger cv_auth_user_created
after insert on auth.users
for each row execute function carvelo_private.create_profile();

-- Audit ownership is assigned on the server, never taken from browser input.
create function carvelo_private.stamp_offer()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  caller_role := carvelo_private.current_role();
  if tg_op = 'INSERT' then
    if caller_role not in ('admin','staff','dealer') or caller_role is null then
      raise exception 'Not authorized to create offers' using errcode = '42501';
    end if;
    new.created_by := auth.uid();
    new.created_at := now();
    if caller_role = 'dealer' then
      new.source := 'dealer';
      new.dealer_id := carvelo_private.current_dealer();
      new.status := 'pending';
    else
      new.source := 'carvelo';
    end if;
  elsif tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.source := old.source;
  end if;
  new.updated_at := now();
  return new;
end
$$;
revoke all on function carvelo_private.stamp_offer() from public;
create trigger cv_offers_stamp
before insert or update on public.cv_offers
for each row execute function carvelo_private.stamp_offer();

alter table public.cv_dealers enable row level security;
alter table public.cv_profiles enable row level security;
alter table public.cv_offers enable row level security;

-- Minimal Data API privileges. Policies are enforced in addition to GRANTs.
revoke all on public.cv_dealers from anon, authenticated;
revoke all on public.cv_profiles from anon, authenticated;
revoke all on public.cv_offers from anon, authenticated;
grant select on public.cv_dealers to anon, authenticated;
grant insert, update on public.cv_dealers to authenticated;
grant select on public.cv_profiles to authenticated;
grant update (role, dealer_id, enabled, display_name) on public.cv_profiles to authenticated;
grant select on public.cv_offers to anon, authenticated;
grant insert, update, delete on public.cv_offers to authenticated;

create policy cv_dealers_read_anon on public.cv_dealers
for select to anon using (active = true);
create policy cv_dealers_read_members on public.cv_dealers
for select to authenticated using (
  active = true
  or (select carvelo_private.current_role()) in ('admin','staff')
  or id = (select carvelo_private.current_dealer())
);
create policy cv_dealers_insert_admin on public.cv_dealers
for insert to authenticated with check ((select carvelo_private.current_role()) = 'admin');
create policy cv_dealers_update_admin on public.cv_dealers
for update to authenticated
using ((select carvelo_private.current_role()) = 'admin')
with check ((select carvelo_private.current_role()) = 'admin');

create policy cv_profiles_read on public.cv_profiles
for select to authenticated
using (id = (select auth.uid()) or (select carvelo_private.current_role()) = 'admin');
create policy cv_profiles_update_admin on public.cv_profiles
for update to authenticated
using ((select carvelo_private.current_role()) = 'admin')
with check ((select carvelo_private.current_role()) = 'admin');

-- Published offers may be browsed without logging in.
create policy cv_offers_public on public.cv_offers
for select to anon using (status = 'published');
create policy cv_offers_member_read on public.cv_offers
for select to authenticated using (
  status = 'published'
  or (select carvelo_private.current_role()) in ('admin','staff')
  or (
    (select carvelo_private.current_role()) = 'dealer'
    and dealer_id = (select carvelo_private.current_dealer())
  )
);
create policy cv_offers_insert on public.cv_offers
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    ((select carvelo_private.current_role()) in ('admin','staff') and source = 'carvelo')
    or (
      (select carvelo_private.current_role()) = 'dealer'
      and source = 'dealer' and status = 'pending'
      and dealer_id = (select carvelo_private.current_dealer())
    )
  )
);
create policy cv_offers_update on public.cv_offers
for update to authenticated
using (
  (select carvelo_private.current_role()) in ('admin','staff')
  or (
    (select carvelo_private.current_role()) = 'dealer'
    and source = 'dealer'
    and dealer_id = (select carvelo_private.current_dealer())
    and status in ('draft','pending','rejected')
  )
)
with check (
  (select carvelo_private.current_role()) in ('admin','staff')
  or (
    (select carvelo_private.current_role()) = 'dealer'
    and source = 'dealer'
    and dealer_id = (select carvelo_private.current_dealer())
    and status in ('draft','pending')
  )
);
create policy cv_offers_delete_admin on public.cv_offers
for delete to authenticated
using ((select carvelo_private.current_role()) = 'admin');

comment on table public.cv_profiles is
  'Secure CARVELO account assignments. Do not grant any role based on user_metadata.';
comment on table public.cv_offers is
  'Central CARVELO vehicle inventory. RLS controls authorized dealer/staff access.';
