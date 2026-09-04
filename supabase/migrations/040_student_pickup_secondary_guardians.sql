-- Los apoderados secundarios también pueden tomar una solicitud iniciada por
-- el estudiante. La función mantiene la carrera protegida por advisory lock.
create or replace function public.claim_student_pickup_authorization(
  p_request_id uuid, p_decision text, p_note text default null
)
returns table (request_id uuid, message_code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  request_record public.authorization_requests%rowtype;
  response_record record;
  response_request_id uuid;
  response_message_code text;
  settings_record public.institution_pickup_settings%rowtype;
  pickup_request_id uuid;
  guardian_pin text;
  student_pin text;
  encryption_key text;
begin
  if auth.uid() is null or public.current_user_role() not in ('APODERADO', 'RETIRADOR_AUTORIZADO') then
    return query select p_request_id, 'AUTH_REQUEST_FORBIDDEN'::text; return;
  end if;
  if p_decision not in ('APPROVED', 'REJECTED') then
    return query select p_request_id, 'AUTH_REQUEST_NOT_ALLOWED'::text; return;
  end if;

  select ar.* into request_record
  from public.authorization_requests ar
  where ar.id = p_request_id and ar.guardian_profile_id = auth.uid()
    and ar.status = 'PENDING'
  for update;
  if not found then return query select p_request_id, 'AUTH_REQUEST_NOT_ALLOWED'::text; return; end if;
  perform pg_advisory_xact_lock(request_record.student_id);
  if request_record.expires_at <= now() then
    update public.authorization_requests set status = 'EXPIRED', responded_at = now() where id = p_request_id;
    return query select p_request_id, 'AUTH_REQUEST_EXPIRED'::text; return;
  end if;

  if p_decision = 'REJECTED' then
    update public.authorization_requests
    set status = 'REJECTED', responded_at = now(), guardian_response_note = nullif(trim(coalesce(p_note, '')), '')
    where id = p_request_id;
    return query select p_request_id, 'AUTH_REQUEST_REJECTED'::text; return;
  end if;

  update public.authorization_requests
  set status = 'CANCELLED', responded_at = now(), guardian_response_note = 'Otro apoderado tomó la solicitud.'
  where claim_group_id = request_record.claim_group_id
    and id <> p_request_id and status = 'PENDING';

  if public.current_user_role() = 'APODERADO' then
    select * into response_record from public.respond_to_authorization_request(
      p_request_id, 'APPROVED', p_note
    );
    response_request_id := response_record.request_id;
    response_message_code := response_record.message_code;
  else
    update public.authorization_requests
    set status = 'APPROVED', responded_at = now(), guardian_response_note = nullif(trim(coalesce(p_note, '')), '')
    where id = p_request_id;

    insert into public.institution_pickup_settings (institution_id)
    values (request_record.institution_id)
    on conflict (institution_id) do nothing;
    select * into settings_record from public.institution_pickup_settings
    where institution_id = request_record.institution_id;
    select s.encryption_key into encryption_key from public.guardian_pickup_secrets s where singleton;
    guardian_pin := public.generate_secure_five_digit_pin();
    student_pin := public.generate_secure_five_digit_pin();
    while student_pin = guardian_pin loop student_pin := public.generate_secure_five_digit_pin(); end loop;

    insert into public.guardian_pickup_requests (
      institution_id, student_id, guardian_profile_id, authorization_request_id,
      status, student_responded_at, expires_at
    ) values (
      request_record.institution_id, request_record.student_id, auth.uid(), request_record.id,
      'PENDING_GUARD_VALIDATION', now(), now() + make_interval(mins => settings_record.pin_ttl_minutes)
    ) returning id into pickup_request_id;

    insert into public.guardian_pickup_pins
      (request_id, actor_type, pin_hash, pin_ciphertext, max_attempts, expires_at)
    values
      (pickup_request_id, 'GUARDIAN', crypt(guardian_pin, gen_salt('bf')), pgp_sym_encrypt(guardian_pin, encryption_key), settings_record.max_pin_attempts, now() + make_interval(mins => settings_record.pin_ttl_minutes)),
      (pickup_request_id, 'STUDENT', crypt(student_pin, gen_salt('bf')), pgp_sym_encrypt(student_pin, encryption_key), settings_record.max_pin_attempts, now() + make_interval(mins => settings_record.pin_ttl_minutes));

    insert into public.guardian_pickup_audit_events
      (request_id, institution_id, actor_profile_id, performed_by_profile_id, event_type, result, method, metadata)
    values (pickup_request_id, request_record.institution_id, auth.uid(),
      auth.uid(), 'STUDENT_EXIT_AUTHORIZED_PINS_CREATED', 'SUCCESS', 'SYSTEM',
      jsonb_build_object('authorization_request_id', request_record.id));

    insert into public.internal_notifications
      (recipient_profile_id, institution_id, notification_type, title, body, entity_type, entity_id)
    select sp.profile_id, request_record.institution_id, 'STUDENT_EXIT_AUTHORIZED', 'Salida autorizada',
      'Tu apoderado aprobó la solicitud. Presenten ambos PIN en portería para confirmar el retiro.',
      'GUARDIAN_PICKUP_REQUEST', pickup_request_id
    from public.student_profiles sp where sp.student_id = request_record.student_id;
    response_request_id := p_request_id;
    response_message_code := 'AUTH_REQUEST_APPROVED_PICKUP_PENDING';
  end if;

  return query select response_request_id, response_message_code;
end;
$$;

revoke all on function public.claim_student_pickup_authorization(uuid, text, text) from public, anon;
grant execute on function public.claim_student_pickup_authorization(uuid, text, text) to authenticated;
notify pgrst, 'reload schema';
