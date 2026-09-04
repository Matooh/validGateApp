-- Una cuenta APODERADO existente puede recibir una autorizacion temporal aunque
-- aun no tenga RUT. La vigencia y el tipo de vinculo viven en guardian_students;
-- no es necesario cambiar el rol global del perfil para crear la autorizacion.
-- Si el perfil ya tiene RUT, se conserva el comportamiento historico y se lo
-- marca como RETIRADOR_AUTORIZADO para las cuentas creadas especificamente con
-- ese proposito.
create or replace function public.create_authorized_retirador_link(
  p_retirador_profile_id uuid,
  p_student_id bigint,
  p_valid_from timestamptz,
  p_valid_until timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  student_institution_id bigint;
  primary_link_id bigint;
  selected_profile public.profiles%rowtype;
begin
  if auth.uid() is null or p_valid_from is null or p_valid_until is null or p_valid_until <= p_valid_from then
    return jsonb_build_object('status', 'invalid');
  end if;

  select institution_id into student_institution_id
  from public.students
  where id = p_student_id;
  if student_institution_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not (
    (public.current_user_role() = 'ADMIN' and student_institution_id = public.current_user_institution_id())
    or (public.current_user_role() = 'APODERADO' and exists (
      select 1 from public.guardian_students gs
      where gs.student_id = p_student_id
        and gs.guardian_profile_id = auth.uid()
        and gs.relation_type = 'APODERADO'
        and public.guardian_student_link_is_active(gs)
    ))
  ) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select * into selected_profile
  from public.profiles p
  where p.id = p_retirador_profile_id
    and p.role in ('APODERADO', 'RETIRADOR_AUTORIZADO')
    and p.institution_id = student_institution_id;
  if not found then
    return jsonb_build_object('status', 'invalid_profile');
  end if;

  perform pg_advisory_xact_lock(p_student_id);

  if exists (
    select 1 from public.guardian_students gs
    where gs.guardian_profile_id = p_retirador_profile_id
      and gs.student_id = p_student_id
      and gs.relation_type = 'RETIRADOR_AUTORIZADO'
      and gs.revoked_at is null
      and gs.valid_until > now()
  ) then
    return jsonb_build_object('status', 'authorization_exists');
  end if;

  select gs.id into primary_link_id
  from public.guardian_students gs
  where gs.guardian_profile_id = p_retirador_profile_id
    and gs.student_id = p_student_id
    and gs.relation_type = 'APODERADO'
  for update;

  if primary_link_id is not null then
    update public.guardian_students
    set relation_type = 'RETIRADOR_AUTORIZADO',
        authorized_by_profile_id = auth.uid(),
        valid_from = p_valid_from,
        valid_until = p_valid_until,
        revoked_at = null,
        revoked_by_profile_id = null
    where id = primary_link_id;
  else
    insert into public.guardian_students (
      guardian_profile_id, student_id, relation_type,
      authorized_by_profile_id, valid_from, valid_until
    ) values (
      p_retirador_profile_id, p_student_id, 'RETIRADOR_AUTORIZADO',
      auth.uid(), p_valid_from, p_valid_until
    );
  end if;

  -- No promover perfiles sin RUT: profiles_retirador_rut_required_chk lo
  -- rechaza y, además, el tipo de vinculo ya identifica la autorizacion.
  if selected_profile.rut is not null then
    update public.profiles
    set role = 'RETIRADOR_AUTORIZADO'
    where id = p_retirador_profile_id and role = 'APODERADO';
  end if;

  return jsonb_build_object('status', case when primary_link_id is null then 'created' else 'converted' end);
end;
$$;

revoke all on function public.create_authorized_retirador_link(uuid, bigint, timestamptz, timestamptz) from public, anon;
grant execute on function public.create_authorized_retirador_link(uuid, bigint, timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
