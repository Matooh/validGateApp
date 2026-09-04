update public.guardian_students secondary
set revoked_at = now(),
    revoked_by_profile_id = coalesce(secondary.revoked_by_profile_id, secondary.authorized_by_profile_id)
where secondary.relation_type = 'RETIRADOR_AUTORIZADO'
  and secondary.revoked_at is null
  and exists (
    select 1 from public.guardian_students primary_link
    where primary_link.guardian_profile_id = secondary.guardian_profile_id
      and primary_link.student_id = secondary.student_id
      and primary_link.relation_type = 'APODERADO'
  );

-- Madre y padre pueden ser ambos Apoderados Primarios.
drop index if exists public.guardian_students_one_primary_per_student;

create or replace function public.admin_link_guardian_to_student(
  p_guardian_profile_id uuid, p_student_id bigint, p_relation_type text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  normalized_relation text := upper(trim(coalesce(p_relation_type, '')));
  admin_institution_id bigint := public.current_user_institution_id();
  existing_secondary_id bigint;
begin
  if auth.uid() is null or public.current_user_role() <> 'ADMIN' or admin_institution_id is null then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if normalized_relation not in ('APODERADO_PRINCIPAL', 'APODERADO', 'RETIRADOR_AUTORIZADO') then
    return jsonb_build_object('status', 'invalid_relation_type');
  end if;
  if not exists (select 1 from public.students s where s.id = p_student_id and s.institution_id = admin_institution_id) then
    return jsonb_build_object('status', 'student_not_found');
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_guardian_profile_id
      and p.role in ('APODERADO', 'RETIRADOR_AUTORIZADO')
      and (p.institution_id = admin_institution_id or exists (
        select 1 from public.guardian_students existing_link
        join public.students linked_student on linked_student.id = existing_link.student_id
        where existing_link.guardian_profile_id = p.id and linked_student.institution_id = admin_institution_id
      ))
  ) then
    return jsonb_build_object('status', 'guardian_not_found');
  end if;

  perform pg_advisory_xact_lock(p_student_id);
  if normalized_relation in ('APODERADO_PRINCIPAL', 'APODERADO') then
    select gs.id into existing_secondary_id from public.guardian_students gs
    where gs.student_id = p_student_id and gs.guardian_profile_id = p_guardian_profile_id
      and gs.relation_type = 'RETIRADOR_AUTORIZADO' and gs.revoked_at is null for update;
    if existing_secondary_id is not null then
      update public.guardian_students set relation_type = 'APODERADO', authorized_by_profile_id = null,
        valid_from = null, valid_until = null, revoked_at = null, revoked_by_profile_id = null
      where id = existing_secondary_id;
      update public.profiles set role = 'APODERADO' where id = p_guardian_profile_id and role = 'RETIRADOR_AUTORIZADO'
        and not exists (select 1 from public.guardian_students other_secondary
          where other_secondary.guardian_profile_id = p_guardian_profile_id
            and other_secondary.relation_type = 'RETIRADOR_AUTORIZADO' and other_secondary.revoked_at is null
            and other_secondary.id <> existing_secondary_id);
      return jsonb_build_object('status', 'promoted');
    end if;
    if exists (select 1 from public.guardian_students gs where gs.student_id = p_student_id and gs.guardian_profile_id = p_guardian_profile_id and gs.relation_type = 'APODERADO') then
      return jsonb_build_object('status', 'linked');
    end if;
    insert into public.guardian_students (guardian_profile_id, student_id, relation_type)
    values (p_guardian_profile_id, p_student_id, 'APODERADO');
    return jsonb_build_object('status', 'linked');
  end if;

  if exists (select 1 from public.guardian_students gs where gs.guardian_profile_id = p_guardian_profile_id and gs.student_id = p_student_id and gs.relation_type = 'RETIRADOR_AUTORIZADO' and gs.revoked_at is null) then
    return jsonb_build_object('status', 'linked');
  end if;
  insert into public.guardian_students (guardian_profile_id, student_id, relation_type)
  values (p_guardian_profile_id, p_student_id, 'RETIRADOR_AUTORIZADO');
  return jsonb_build_object('status', 'linked');
end;
$$;

revoke all on function public.admin_link_guardian_to_student(uuid, bigint, text) from public, anon;
grant execute on function public.admin_link_guardian_to_student(uuid, bigint, text) to authenticated;
