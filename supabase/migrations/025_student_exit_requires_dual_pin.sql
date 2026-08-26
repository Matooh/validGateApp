alter table public.guardian_pickup_requests
add column if not exists authorization_request_id uuid
references public.authorization_requests(id) on delete set null;

create unique index if not exists guardian_pickup_authorization_request_unique
on public.guardian_pickup_requests(authorization_request_id)
where authorization_request_id is not null;

create or replace function public.respond_to_authorization_request(
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns table (
  request_id uuid,
  message_code text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  request_record public.authorization_requests%rowtype;
  settings_record public.institution_pickup_settings%rowtype;
  pickup_request_id uuid;
  guardian_pin text;
  student_pin text;
  encryption_key text;
begin
  request_id := p_request_id;

  if auth.uid() is null or public.current_user_role() <> 'APODERADO' then
    message_code := 'AUTH_REQUEST_FORBIDDEN';
    return next;
    return;
  end if;

  if p_decision not in ('APPROVED', 'REJECTED') then
    message_code := 'AUTH_REQUEST_NOT_ALLOWED';
    return next;
    return;
  end if;

  select ar.*
  into request_record
  from public.authorization_requests ar
  where ar.id = p_request_id
    and ar.guardian_profile_id = auth.uid()
    and exists (
      select 1
      from public.guardian_students gs
      where gs.student_id = ar.student_id
        and gs.guardian_profile_id = auth.uid()
    )
  for update;

  if not found then
    message_code := 'AUTH_REQUEST_FORBIDDEN';
    return next;
    return;
  end if;

  if request_record.status <> 'PENDING' then
    message_code := 'AUTH_REQUEST_NOT_ALLOWED';
    return next;
    return;
  end if;

  if request_record.expires_at <= now() then
    update public.authorization_requests
    set status = 'EXPIRED', responded_at = now()
    where id = request_record.id;

    message_code := 'AUTH_REQUEST_EXPIRED';
    return next;
    return;
  end if;

  update public.authorization_requests
  set status = p_decision,
      guardian_response_note = nullif(trim(coalesce(p_note, '')), ''),
      responded_at = now()
  where id = request_record.id;

  if p_decision = 'REJECTED' then
    message_code := 'AUTH_REQUEST_REJECTED';
    return next;
    return;
  end if;

  if request_record.request_type = 'EXIT_ALONE' then
    if not exists (
      select 1 from public.students s
      where s.id = request_record.student_id and s.is_in_institution
    ) then
      message_code := 'AUTH_REQUEST_STUDENT_NOT_INSIDE';
      return next;
      return;
    end if;

    insert into public.institution_pickup_settings (institution_id)
    values (request_record.institution_id)
    on conflict (institution_id) do nothing;

    select *
    into settings_record
    from public.institution_pickup_settings
    where institution_id = request_record.institution_id;

    select s.encryption_key
    into encryption_key
    from public.guardian_pickup_secrets s
    where singleton;

    guardian_pin := public.generate_secure_five_digit_pin();
    student_pin := public.generate_secure_five_digit_pin();
    while student_pin = guardian_pin loop
      student_pin := public.generate_secure_five_digit_pin();
    end loop;

    insert into public.guardian_pickup_requests (
      institution_id,
      student_id,
      guardian_profile_id,
      authorization_request_id,
      status,
      student_responded_at,
      expires_at
    )
    values (
      request_record.institution_id,
      request_record.student_id,
      request_record.guardian_profile_id,
      request_record.id,
      'PENDING_GUARD_VALIDATION',
      now(),
      now() + make_interval(mins => settings_record.pin_ttl_minutes)
    )
    returning id into pickup_request_id;

    insert into public.guardian_pickup_pins (
      request_id,
      actor_type,
      pin_hash,
      pin_ciphertext,
      max_attempts,
      expires_at
    )
    values
      (
        pickup_request_id,
        'GUARDIAN',
        crypt(guardian_pin, gen_salt('bf')),
        pgp_sym_encrypt(guardian_pin, encryption_key),
        settings_record.max_pin_attempts,
        now() + make_interval(mins => settings_record.pin_ttl_minutes)
      ),
      (
        pickup_request_id,
        'STUDENT',
        crypt(student_pin, gen_salt('bf')),
        pgp_sym_encrypt(student_pin, encryption_key),
        settings_record.max_pin_attempts,
        now() + make_interval(mins => settings_record.pin_ttl_minutes)
      );

    insert into public.guardian_pickup_audit_events (
      request_id,
      institution_id,
      actor_profile_id,
      performed_by_profile_id,
      event_type,
      result,
      method,
      metadata
    )
    values (
      pickup_request_id,
      request_record.institution_id,
      request_record.guardian_profile_id,
      auth.uid(),
      'STUDENT_EXIT_AUTHORIZED_PINS_CREATED',
      'SUCCESS',
      'SYSTEM',
      jsonb_build_object('authorization_request_id', request_record.id)
    );

    insert into public.internal_notifications (
      recipient_profile_id,
      institution_id,
      notification_type,
      title,
      body,
      entity_type,
      entity_id
    )
    select
      sp.profile_id,
      request_record.institution_id,
      'STUDENT_EXIT_AUTHORIZED',
      'Salida autorizada',
      'Tu apoderado aprobó la solicitud. Presenten ambos PIN en portería para confirmar el retiro.',
      'GUARDIAN_PICKUP_REQUEST',
      pickup_request_id
    from public.student_profiles sp
    where sp.student_id = request_record.student_id;

    message_code := 'AUTH_REQUEST_APPROVED_PICKUP_PENDING';
    return next;
    return;
  end if;

  insert into public.student_exit_authorizations (
    authorization_request_id,
    institution_id,
    student_id,
    guardian_profile_id,
    valid_until,
    used_at,
    created_by_profile_id
  )
  values (
    request_record.id,
    request_record.institution_id,
    request_record.student_id,
    request_record.guardian_profile_id,
    now() + interval '30 minutes',
    now(),
    auth.uid()
  );

  insert into public.access_events (
    student_id,
    actor_profile_id,
    recorded_by_profile_id,
    event_type,
    exit_kind,
    validation_kind,
    result,
    notes,
    access_mode,
    contingency_reason,
    contingency_note,
    authenticator_required,
    authenticator_presented
  )
  values (
    request_record.student_id,
    auth.uid(),
    request_record.requested_by_profile_id,
    'SALIDA',
    'SOLO',
    'MANUAL',
    'APROBADO',
    concat(
      'Salida por contingencia autorizada por el apoderado.',
      case when request_record.contingency_note is not null
        then ' Observacion: ' || request_record.contingency_note
        else '' end
    ),
    'CONTINGENCIA_SIN_DISPOSITIVO',
    request_record.contingency_reason,
    request_record.contingency_note,
    true,
    false
  );

  message_code := 'AUTH_REQUEST_APPROVED';
  return next;
end;
$$;

revoke all on function public.respond_to_authorization_request(uuid, text, text) from public;
grant execute on function public.respond_to_authorization_request(uuid, text, text) to authenticated;

comment on function public.respond_to_authorization_request(uuid, text, text) is
  'Las salidas solicitadas por estudiantes requieren PIN dual y confirmacion de porteria; las contingencias conservan su flujo autorizado.';

notify pgrst, 'reload schema';
