-- Permite al Apoderado Primario revocar autorizaciones secundarias
-- de estudiantes que tiene vinculados, aunque la autorización la haya
-- creado un administrador.
create or replace function public.revoke_authorized_retirador_link(p_relation_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_id bigint;
begin
  update public.guardian_students gs
  set revoked_at = now(), revoked_by_profile_id = auth.uid()
  from public.students s
  where gs.id = p_relation_id
    and gs.student_id = s.id
    and gs.relation_type = 'RETIRADOR_AUTORIZADO'
    and gs.revoked_at is null
    and (
      gs.authorized_by_profile_id = auth.uid()
      or (
        public.current_user_role() = 'ADMIN'
        and s.institution_id = public.current_user_institution_id()
      )
      or (
        public.current_user_role() = 'APODERADO'
        and exists (
          select 1
          from public.guardian_students own_link
          where own_link.student_id = s.id
            and own_link.guardian_profile_id = auth.uid()
            and own_link.relation_type = 'APODERADO'
            and public.guardian_student_link_is_active(own_link)
        )
      )
    )
  returning gs.id into changed_id;

  return jsonb_build_object('status', case when changed_id is null then 'not_found' else 'revoked' end);
end;
$$;

revoke all on function public.revoke_authorized_retirador_link(bigint) from public, anon;
grant execute on function public.revoke_authorized_retirador_link(bigint) to authenticated;
