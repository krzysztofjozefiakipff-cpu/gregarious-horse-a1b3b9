-- Allow creation of private AI candidates while an offer is published.
-- The original published image is NEVER switched by this change.
-- Applying a candidate still requires staff to unpublish first.
do $$
declare src text;
begin
  src=pg_get_functiondef('public.cv_ai_claim(text)'::regprocedure);
  if position('o.status <> ''published'' and ph.state <> ''rejected''' in src)=0
    then raise exception 'cv_ai_claim function changed'; end if;
  src=replace(src,'o.status <> ''published'' and ph.state <> ''rejected''',
                  'ph.state <> ''rejected''');
  execute src;

  src=pg_get_functiondef(
     'public.cv_ai_complete_v2(uuid,text,text,boolean,numeric,text)'::regprocedure);
  if position('not found or previous.offer_status=''published''' in src)=0
    then raise exception 'cv_ai_complete_v2 function changed'; end if;
  src=replace(src,'not found or previous.offer_status=''published''','not found');
  execute src;
end $$;
