do $manual$
declare fn text;
begin
 select pg_get_functiondef(p.oid) into fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='cv_ai_fail';
 if fn is null then raise exception 'cv_ai_fail missing'; end if;
 if position('code like ''window_mask_uncertain%''' in fn)=0 then
 raise exception 'safe mask failure guard not found'; end if;
 fn:=replace(fn, 'code like ''window_mask_uncertain%''',
 '''code like ''manual_mask_%'' or code like ''window_mask_uncertain%''');
 execute fn;
end $manual$;
