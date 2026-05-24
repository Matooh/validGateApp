create or replace function public.confirm_student_self_exit()
returns table (
  event_id bigint,
  student_id bigint,
  message_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  student_record public.students%rowtype;
  credential_record public.student_qr_credentials%rowtype;
begin
  if auth.uid() is null or public.current_user_role() <> 'ESTUDIANTE' then
    message_code := 'AUTH_REQUEST_FORBIDDEN';
    return next;
    return;
  end if;

  select s.*
  into student_record
  from public.student_profiles sp
  join public.students s
    on s.id = sp.student_id
   and s.institution_id = sp.institution_id
  where sp.profile_id = auth.uid()
  limit 1
  for update of s;

  if not found then
    message_code := 'STUDENT_PROFILE_NOT_LINKED';
    return next;
    return;
  end if;

  student_id := student_record.id;

  if not student_record.is_in_institution then
    message_code := 'QR_STUDENT_NOT_INSIDE';
    return next;
    return;
  end if;

  if not student_record.can_leave_alone then
    message_code := 'QR_EXIT_NOT_ALLOWED_ALONE';
    return next;
    return;
  end if;

  select *
  into credential_record
  from public.student_qr_credentials sqc
  where sqc.student_id = student_record.id
    and sqc.institution_id = student_record.institution_id
    and sqc.created_by = auth.uid()
    and sqc.used_at is null
    and sqc.revoked_at is null
    and sqc.expires_at > now()
  order by sqc.created_at desc
  limit 1
  for update;

  if not found then
    message_code := 'QR_NOT_FOUND';
    return next;
    return;
  end if;

  update public.student_qr_credentials
  set used_at = now()
  where id = credential_record.id
    and used_at is null;

  if not found then
    message_code := 'QR_ALREADY_USED';
    return next;
    return;
  end if;

  insert into public.access_events (
    student_id,
    actor_profile_id,
    recorded_by_profile_id,
    event_type,
    exit_kind,
    validation_kind,
    result,
    notes
  )
  values (
    student_record.id,
    auth.uid(),
    auth.uid(),
    'SALIDA',
    'SOLO',
    'QR',
    'APROBADO',
    'Salida registrada por voluntad del estudiante autorizado. Evento visible para apoderado vinculado.'
  )
  returning id into event_id;

  message_code := 'ACCESS_EXIT_REGISTERED';
  return next;
end;
$$;

grant execute on function public.confirm_student_self_exit() to authenticated;

comment on function public.confirm_student_self_exit() is
  'Permite a un estudiante autorizado registrar su propia salida si esta dentro de la institucion y tiene una credencial QR vigente.';
