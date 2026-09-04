-- Permite deshabilitar acciones repetidas cuando otro apoderado ya tomó el retiro,
-- sin exponer los datos del retiro ni el PIN del responsable que lo tomó.
create or replace function public.list_active_pickup_student_ids(p_student_ids bigint[])
returns table (student_id bigint)
language sql stable security definer set search_path = public as $$
  select distinct r.student_id
  from public.guardian_pickup_requests r
  where r.student_id = any(coalesce(p_student_ids, array[]::bigint[]))
    and r.status in ('PENDING_STUDENT_RESPONSE', 'PENDING_GUARD_VALIDATION', 'BOTH_VALIDATED')
    and (
      r.guardian_profile_id = auth.uid()
      or exists (
        select 1 from public.guardian_students gs
        where gs.student_id = r.student_id
          and gs.guardian_profile_id = auth.uid()
          and public.guardian_student_link_is_active(gs)
      )
      or (public.current_user_role() in ('ADMIN', 'PORTERIA')
          and r.institution_id = public.current_user_institution_id())
    );
$$;

revoke all on function public.list_active_pickup_student_ids(bigint[]) from public, anon;
grant execute on function public.list_active_pickup_student_ids(bigint[]) to authenticated;
notify pgrst, 'reload schema';
