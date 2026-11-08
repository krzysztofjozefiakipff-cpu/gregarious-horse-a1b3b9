-- CARVELO: fix missing SQL SELECT grant for public published offers.
-- RLS policy cv_offers_public already limits anon to status='published'.
-- This GRANT does not expose drafts, pending, or rejected offers.
grant select on table public.cv_offers to anon;
