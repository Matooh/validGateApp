create or replace function public.confirm_student_qr_access_event(
  p_credential_id uuid,
  p_event_type text
)
returns table (
  credential_id uuid,
  student_id bigint,
  event_type public.access_event_type,
  exit_kind public.exit_type,
  message_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  credential_record public.student_qr_credentials%rowtype;
  student_record public.students%rowtype;
  normalized_event_type text;
  access_event_type public.access_event_type;
  access_exit_kind public.exit_type;
begin
  credential_id := p_credential_id;

  if auth.uid() is null or public.current_user_role() not in ('ADMIN', 'PORTERIA') then
    message_code := 'QR_FORBIDDEN';
    return next;
    return;
  end if;

  normalized_event_type := upper(trim(p_event_type));

  if normalized_event_type = 'INGRESO' then
    access_event_type := 'INGRESO';
    access_exit_kind := null;
  elsif normalized_event_type = 'SALIDA' then
    access_event_type := 'SALIDA';
    access_exit_kind := 'REGULAR';
  elsif normalized_event_type = 'RETIRO' then
    access_event_type := 'SALIDA';
    access_exit_kind := 'RETIRO_AUTORIZADO';
  else
    message_code := 'QR_INVALID_EVENT';
    return next;
    return;
  end if;

  select *
  into credential_record
  from public.student_qr_credentials sqc
  where sqc.id = p_credential_id
    and sqc.institution_id = public.current_user_institution_id()
  for update;

  if not found then
    message_code := 'QR_NOT_FOUND';
    return next;
    return;
  end if;

  student_id := credential_record.student_id;

  if credential_record.revoked_at is not null then
    message_code := 'QR_REVOKED';
    return next;
    return;
  end if;

  if credential_record.used_at is not null then
    message_code := 'QR_ALREADY_USED';
    return next;
    return;
  end if;

  if credential_record.expires_at <= now() then
    message_code := 'QR_EXPIRED';
    return next;
    return;
  end if;

  select *
  into student_record
  from public.students s
  where s.id = credential_record.student_id
    and s.institution_id = credential_record.institution_id
  for update;

  if not found then
    message_code := 'QR_NOT_FOUND';
    return next;
    return;
  end if;

  if access_event_type = 'INGRESO' and student_record.is_in_institution then
    message_code := 'QR_ENTRY_ALREADY_ACTIVE';
    return next;
    return;
  end if;

  if access_event_type = 'SALIDA' and not student_record.is_in_institution then
    message_code := 'QR_STUDENT_NOT_INSIDE';
    return next;
    return;
  end if;

  if normalized_event_type = 'SALIDA' and not student_record.can_leave_alone then
    message_code := 'QR_EXIT_NOT_ALLOWED_ALONE';
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
    recorded_by_profile_id,
    event_type,
    exit_kind,
    validation_kind,
    result,
    notes
  )
  values (
    credential_record.student_id,
    auth.uid(),
    access_event_type,
    access_exit_kind,
    'QR',
    'APROBADO',
    case
      when normalized_event_type = 'RETIRO' then 'Retiro confirmado mediante credencial QR temporal'
      else 'Evento confirmado mediante credencial QR temporal'
    end
  );

  event_type := access_event_type;
  exit_kind := access_exit_kind;
  message_code := 'QR_EVENT_REGISTERED';
  return next;
end;
$$;

grant execute on function public.confirm_student_qr_access_event(uuid, text) to authenticated;
