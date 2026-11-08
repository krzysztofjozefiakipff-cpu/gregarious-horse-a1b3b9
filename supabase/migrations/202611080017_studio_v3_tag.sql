-- Versioned studio metadata for new photorealistic contact shadows.
create or replace function public.cv_ai_complete_v3(
 p_job uuid,p_run_id text,p_result_path text,p_window_changed boolean,
 p_mask_confidence numeric,p_review_reason text,p_scene_version text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_scene_version not in ('studio-v2','studio-v3')
 then raise exception 'unsupported_studio_scene_version'; end if;
 result:=public.cv_ai_complete_v2(
   p_job,p_run_id,p_result_path,p_window_changed,p_mask_confidence,p_review_reason
 );
 update public.cv_photo_versions set scene_version=p_scene_version
 where id=(result->>'version_id')::uuid;
 return result;
end $$;
revoke all on function public.cv_ai_complete_v3(uuid,text,text,boolean,numeric,text,text)
 from public,anon,authenticated;
grant execute on function public.cv_ai_complete_v3(uuid,text,text,boolean,numeric,text,text)
 to service_role;