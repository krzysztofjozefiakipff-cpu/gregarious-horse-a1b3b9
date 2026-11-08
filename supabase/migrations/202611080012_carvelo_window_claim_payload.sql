do $job$
declare fn text;
begin
 select pg_get_functiondef(p.oid) into fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='cv_ai_claim';
 if fn is null then raise exception 'cv_ai_claim missing'; end if;
 if position('''attempt'',j.attempts+1)' in fn)=0 then
 raise exception 'expected claim response fragment not found'; end if;
 fn:=replace(fn, '''attempt'',j.attempts+1)', '''attempt'',j.attempts+1,''window_polygons'',j.window_polygons)');
 execute fn;
end $job$;
