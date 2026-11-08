-- Supabase service-role RPC for OIDC broker: scoped access to exactly one private pgmq queue.
-- pgmq is not an exposed Data API schema. Browser roles get no access.
grant usage on schema pgmq to service_role;
grant select on table pgmq.meta to service_role;
grant select,insert,update,delete on table pgmq.q_carvelo_photo_ai to service_role;
grant select,insert,update,delete on table pgmq.a_carvelo_photo_ai to service_role;
