-- Corrige la colision entre la columna request_id y la columna de salida
-- homonima de confirm_guardian_pickup en instalaciones que ya aplicaron 026.
create or replace function public.confirm_guardian_pickup(p_request_id uuid)
returns table (request_id uuid, event_id bigint, message_code text)
language plpgsql security definer set search_path = public as $$
declare
  request_record public.guardian_pickup_requests%rowtype;
  event_identifier bigint;
begin
  if auth.uid() is null or public.current_user_role() not in ('ADMIN', 'PORTERIA') then
    return query select p_request_id, null::bigint, 'PICKUP_FORBIDDEN'::text;
    return;
  end if;

  select pickup_request.* into request_record
  from public.guardian_pickup_requests as pickup_request
  where pickup_request.id = p_request_id
    and pickup_request.institution_id = public.current_user_institution_id()
  for update;

  if not found or request_record.status <> 'BOTH_VALIDATED'
    or request_record.guardian_validation_method is null
    or request_record.student_validation_method is null then
    return query select p_request_id, null::bigint, 'PICKUP_NOT_READY'::text;
    return;
  end if;

  if request_record.authorization_link_id is not null and not exists (
    select 1
    from public.guardian_students as guardian_student
    where guardian_student.id = request_record.authorization_link_id
      and public.guardian_student_link_is_active(guardian_student)
  ) then
    update public.guardian_pickup_requests as pickup_request
    set status = 'CANCELLED_AUTHORIZATION_REVOKED',
      cancelled_at = now(),
      terminal_note = 'Autorizacion temporal no vigente'
    where pickup_request.id = request_record.id;

    update public.guardian_pickup_pins as pickup_pin
    set invalidated_at = coalesce(pickup_pin.invalidated_at, now())
    where pickup_pin.request_id = request_record.id;

    return query select p_request_id, null::bigint, 'PICKUP_NOT_AUTHORIZED'::text;
    return;
  end if;

  if request_record.expires_at <= now() then
    update public.guardian_pickup_requests as pickup_request
    set status = 'EXPIRED'
    where pickup_request.id = request_record.id;

    update public.guardian_pickup_pins as pickup_pin
    set invalidated_at = coalesce(pickup_pin.invalidated_at, now())
    where pickup_pin.request_id = request_record.id;

    return query select p_request_id, null::bigint, 'PICKUP_PIN_EXPIRED'::text;
    return;
  end if;

  if not exists (
    select 1
    from public.students as student
    where student.id = request_record.student_id
      and student.is_in_institution
  ) then
    return query select p_request_id, null::bigint, 'PICKUP_STUDENT_NOT_INSIDE'::text;
    return;
  end if;

  insert into public.access_events (
    student_id, actor_profile_id, recorded_by_profile_id, event_type, exit_kind,
    validation_kind, result, notes, authenticator_required, authenticator_presented,
    policy_snapshot
  ) values (
    request_record.student_id, request_record.guardian_profile_id, auth.uid(),
    'SALIDA', 'RETIRO_AUTORIZADO', 'PIN', 'APROBADO',
    'Retiro confirmado por porteria con validacion dual.', true, true,
    jsonb_build_object(
      'pickup_request_id', request_record.id,
      'authorization_link_id', request_record.authorization_link_id,
      'guardian_method', request_record.guardian_validation_method,
      'student_method', request_record.student_validation_method
    )
  ) returning id into event_identifier;

  update public.guardian_pickup_pins as pickup_pin
  set invalidated_at = coalesce(pickup_pin.invalidated_at, now())
  where pickup_pin.request_id = request_record.id;

  update public.guardian_pickup_requests as pickup_request
  set status = 'COMPLETED', completed_at = now(), completed_by = auth.uid()
  where pickup_request.id = request_record.id;

  insert into public.guardian_pickup_audit_events (
    request_id, institution_id, actor_profile_id, performed_by_profile_id,
    event_type, result, method, metadata
  ) values (
    request_record.id, request_record.institution_id,
    request_record.guardian_profile_id, auth.uid(),
    'PICKUP_COMPLETED', 'SUCCESS', 'SYSTEM',
    jsonb_build_object('access_event_id', event_identifier)
  );

  return query select p_request_id, event_identifier, 'PICKUP_COMPLETED'::text;
end;
$$;
